import type {
  HexString,
  BigNumberish,
  BytesLike,
  Proof,
  Provider,
  Resolvable,
} from './types.js';
import type { Block } from 'ethers';
import { Interface } from 'ethers/abi';
import {
  hexlify,
  toBeHex,
  toUtf8Bytes,
  getBytes,
  concat,
  dataSlice,
} from 'ethers/utils';
import { solidityPackedKeccak256 } from 'ethers/hash';
import { keccak256 } from 'ethers/crypto';
import { ZeroAddress } from 'ethers/constants';
import { SmartCache } from './SmartCache.js';

type RPCEthGetProof = {
  address: HexString;
  balance: HexString;
  codeHash: HexString;
  nonce: HexString;
  accountProof: Proof;
  storageHash: HexString;
  storageProof: { proof: Proof }[];
};

type VerifierContext = BytesLike;

const MAX_OUTPUTS = 255;
const MAX_INPUTS = 255;
//const MAX_STACK = 32;

const STEP_BYTES = 255;

const OP_TARGET = 1;
const OP_TARGET_FIRST = 2;

const OP_COLLECT = 5;
const OP_COLLECT_FIRST = 6;
const OP_COLLECT_RANGE = 7;

const OP_PUSH_INPUT = 10;
const OP_PUSH_OUTPUT = 11;
const OP_PUSH_SLOT = 12;
const OP_PUSH_TARGET = 13;
const OP_PUSH_STACK = 14;

const OP_SLOT_ADD = 20;
const OP_SLOT_FOLLOW = 21;
const OP_SLOT_SET = 22;

const OP_STACK_KECCAK = 30;
const OP_STACK_CONCAT = 31;
const OP_STACK_SLICE = 32;
const OP_STACK_FIRST = 33;

export const GATEWAY_ABI = new Interface([
  // v1
  `function getStorageSlots(address addr, bytes32[] memory commands, bytes[] memory constants) external pure returns(bytes memory witness)`,
  // v2
  `function fetch(bytes context, tuple(bytes ops, bytes[] inputs) request) returns (bytes memory)`,
]);

function uint256FromHex(s: HexString) {
  // the following should be equivalent to EVMProofHelper._toUint256()
  return s === '0x' ? 0n : BigInt(s.slice(0, 66));
}
function addressFromHex(s: HexString) {
  // the following should be equivalent to: address(uint160(_toUint256(x)))
  return (
    '0x' +
    (s.length >= 66
      ? s.slice(26, 66)
      : s.slice(2).padStart(40, '0').slice(-40)
    ).toLowerCase()
  );
}
function isNonzeroHex(s: string) {
  return !/^0x0*$/.test(s);
}

export class EVMRequestV1 {
  target: HexString;
  readonly commands: HexString[];
  readonly constants: HexString[];
  private readonly buf: number[];
  constructor(
    target: HexString = ZeroAddress,
    commands: HexString[] = [],
    constants: HexString[] = [],
    buf: number[] = []
  ) {
    this.target = target;
    this.commands = commands;
    this.constants = constants;
    this.buf = buf;
  }
  clone() {
    return new EVMRequestV1(
      this.target,
      this.commands.slice(),
      this.constants.slice(),
      this.buf.slice()
    );
  }
  private addConst(x: BytesLike) {
    if (this.constants.length >= 32) throw new Error('constants overflow');
    this.constants.push(hexlify(x));
    return this.constants.length - 1;
  }
  private start(flags: number, slot: BigNumberish) {
    this.end();
    this.buf.push(flags, this.addConst(toBeHex(slot, 32)));
    return this;
  }
  end() {
    const { buf } = this;
    if (!buf.length) return;
    if (buf.length < 32 && buf[buf.length - 1] != 0xff) buf.push(0xff);
    const word = new Uint8Array(32);
    word.set(buf);
    this.commands.push(hexlify(word));
    buf.length = 0;
  }
  getStatic(slot: BigNumberish) {
    return this.start(0, slot);
  }
  getDynamic(slot: BigNumberish) {
    return this.start(1, slot);
  }
  ref(i: number) {
    this.buf.push((1 << 5) | i); // OP_BACKREF
    return this;
  }
  element(x: BigNumberish) {
    return this.elementBytes(toBeHex(x, 32));
  }
  elementStr(s: string) {
    return this.elementBytes(toUtf8Bytes(s));
  }
  elementBytes(x: BytesLike) {
    this.buf.push(this.addConst(x));
    return this;
  }
  encode() {
    this.end();
    return GATEWAY_ABI.encodeFunctionData('getStorageSlots', [
      this.target,
      this.commands,
      this.constants,
    ]);
  }
  v2() {
    this.end();
    const req = new EVMRequest();
    req.push(this.target);
    req.target();
    for (const cmd of this.commands) {
      try {
        const v = getBytes(cmd);
        req.setSlot(this.constants[v[1]]); // first op is initial slot offset
        for (let i = 2; i < v.length; i++) {
          const op = v[i];
          if (op === 0xff) break;
          const operand = op & 0x1f;
          switch (op >> 5) {
            case 0: {
              // OP_CONSTANT
              req.pushBytes(this.constants[operand]).follow();
              continue;
            }
            case 1: {
              // OP_BACKREF
              req.pushOutput(operand).follow();
              continue;
            }
            default:
              throw new Error(`unknown op: ${op}`);
          }
        }
        req.collect(v[0] & 1 ? STEP_BYTES : 0);
      } catch (err) {
        Object.assign(err!, { cmd });
        throw err;
      }
    }
    return req;
  }
}

export class EVMRequest {
  static decode(data: BytesLike) {
    // eslint-disable-next-line prefer-const
    let [context, [ops, inputs]] = GATEWAY_ABI.decodeFunctionData(
      'fetch',
      data
    );
    ops = getBytes(ops);
    return new this(ops, inputs, ops.length, context);
  }
  private buf: Uint8Array;
  private pos: number;
  readonly inputs: HexString[];
  context: VerifierContext | undefined;
  constructor(
    buf = new Uint8Array(1024),
    inputs: HexString[] = [],
    pos: number = 1,
    context?: VerifierContext
  ) {
    this.buf = buf;
    this.pos = pos;
    this.inputs = inputs;
    this.context = context;
  }
  clone() {
    return new EVMRequest(
      this.buf.slice(),
      this.inputs.slice(),
      this.pos,
      this.context
    );
  }
  encode(context?: VerifierContext) {
    return GATEWAY_ABI.encodeFunctionData('fetch', [
      context ?? this.context ?? '0x',
      [this.ops, this.inputs],
    ]);
  }
  get ops(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
  private addOp(op: number) {
    // if (Number.isSafeInteger(op) || op < 0) throw Object.assign(new Error('invalid op'), {op});
    // while (op > 127) {
    // 	this.buf[this.pos++] = (op & 127) | 128;
    // 	op >>= 7;
    // }
    // this.buf[this.pos++] = op;
    if ((op & 0xff) !== op)
      throw Object.assign(new Error('expected uint8'), { op });
    if (this.pos >= this.buf.length) throw new Error('overflow: ops');
    this.buf[this.pos++] = op;
    return this;
  }
  // private addBigOp(arg: number) {
  // 	if ((arg & 0xFFFFFF) !== arg) throw Object.assign(new Error('expected uint24'), {arg});
  // 	if (this.pos + 3 >= this.buf.length) throw new Error('op overflow');
  // 	this.buf[this.pos++] = arg >> 16;
  // 	this.buf[this.pos++] = arg >> 8;
  // 	this.buf[this.pos++] = arg;
  // 	return this;
  // }
  private addInput(v: BytesLike) {
    if (this.inputs.length == MAX_INPUTS) throw new Error('overflow: inputs');
    this.inputs.push(hexlify(v));
    return this.inputs.length - 1;
  }
  private addOutput() {
    const oi = this.buf[0];
    if (oi == MAX_OUTPUTS) throw new Error('overflow: outputs');
    this.buf[0] = oi + 1;
    return oi;
  }

  get outputCount() {
    return this.buf[0];
  }

  target() {
    return this.addOp(OP_TARGET);
  }
  firstTarget() {
    return this.addOp(OP_TARGET_FIRST);
  }
  setTarget(address: HexString) {
    return this.push(address).target();
  }

  collect(step: number) {
    this.addOp(OP_COLLECT).addOp(step).addOutput();
    return this;
  }
  getValue() {
    return this.collect(0);
  }
  getBytes() {
    return this.collect(STEP_BYTES);
  }

  collectFirstNonzero(step: number) {
    this.addOp(OP_COLLECT_FIRST).addOp(step).addOutput();
    return this;
  }
  getFirstNonzeroValue() {
    return this.collectFirstNonzero(0);
  }
  getFirstNonzeroBytes() {
    return this.collectFirstNonzero(STEP_BYTES);
  }

  getValues(n: number) {
    this.addOp(OP_COLLECT_RANGE).addOp(n).addOutput();
    return this;
  }

  push(x: BigNumberish) {
    return this.pushBytes(toBeHex(x, 32));
  }
  pushStr(s: string) {
    return this.pushBytes(toUtf8Bytes(s));
  }
  pushBytes(x: BytesLike) {
    return this.addOp(OP_PUSH_INPUT).addOp(this.addInput(x));
  }

  pushInput(ii: number) {
    return this.addOp(OP_PUSH_INPUT).addOp(ii);
  }
  pushOutput(oi: number) {
    return this.addOp(OP_PUSH_OUTPUT).addOp(oi);
  }
  pushStack(si: number) {
    return this.addOp(OP_PUSH_STACK).addOp(si);
  }
  pushSlotRegister() {
    return this.addOp(OP_PUSH_SLOT);
  }
  pushTargetRegister() {
    return this.addOp(OP_PUSH_TARGET);
  }

  add() {
    return this.addOp(OP_SLOT_ADD);
  }
  addSlot(slot: BigNumberish) {
    return this.push(slot).add();
  }

  set() {
    return this.addOp(OP_SLOT_SET);
  }
  setSlot(slot: BigNumberish) {
    return this.push(slot).set();
  }

  follow() {
    return this.addOp(OP_SLOT_FOLLOW);
  }
  element(key: BigNumberish) {
    return this.push(key).follow();
  }
  elementStr(key: string) {
    return this.pushStr(key).follow();
  }
  elementBytes(key: BytesLike) {
    return this.pushBytes(key).follow();
  }
  elementOutput(oi: number) {
    return this.pushOutput(oi).follow();
  }

  concat(n: number) {
    return this.addOp(OP_STACK_CONCAT).addOp(n);
  }
  keccak() {
    return this.addOp(OP_STACK_KECCAK);
  }
  slice(pos: number, len: number) {
    return this.addOp(OP_STACK_SLICE).addOp(pos).addOp(len);
  } // bigOp
  replaceWithFirstNonzero() {
    return this.addOp(OP_STACK_FIRST);
  }
}

type OutputHeader = {
  target: HexString;
  slots: bigint[];
};
export type Output = OutputHeader & {
  size?: number;
  parent?: EVMProver;
  hidden?: boolean; // cosmetic: indicates that an output is part of conditional operation
  value(): Promise<HexString>;
};
export type ResolvedOutput = OutputHeader & { value: HexString }; // none of which are hidden

export class EVMProver {
  static async latest(provider: Provider) {
    // TODO: should this use finalized blocktag?
    // unclear if eth_blockNumber is finalized
    // let block = await provider.getBlock('finalized');
    // if (!block) throw new Error(`expected finalized block`);
    // return new this(provider, toBeHex(block.number));
    const block = await provider.getBlockNumber();
    return new this(provider, toBeHex(block));
  }
  static async resolved(outputs: Output[]): Promise<ResolvedOutput[]> {
    // fully resolve and unwrap the values
    return Promise.all(
      outputs
        .filter((x) => !x.hidden)
        .map(async (x) => {
          return { ...x, value: await x.value() };
        })
    );
  }
  static async executed(provider: Provider, req: EVMRequest) {
    // get resolved outputs from request at latest block of provider
    const p = await this.latest(provider);
    return p.execute(req);
  }
  readonly provider: Provider;
  readonly block: HexString;
  readonly maxBytes: number = 1 << 13; // 8KB
  readonly cache: SmartCache;
  constructor(provider: Provider, block: HexString, cache = new SmartCache()) {
    this.provider = provider;
    this.block = block;
    this.cache = cache;
  }
  async getBlock(): Promise<Block> {
    return this.cache.get('BLOCK', () => this.provider.getBlock(this.block));
  }
  async getStateRoot(): Promise<HexString> {
    const { stateRoot } = await this.getBlock();
    if (!stateRoot)
      throw Object.assign(new Error('null stateRoot'), { block: this.block });
    return stateRoot;
  }
  async getExists(target: HexString): Promise<boolean> {
    // assuming this is cheaper than eth_getProof with 0 slots
    // why isn't there eth_getCodehash?
    return this.cache.get(target, (t) =>
      this.provider.getCode(t, this.block).then((x) => x.length > 2)
    );
  }
  async getStorage(target: HexString, slot: BigNumberish): Promise<HexString> {
    target = target.toLowerCase(); // this should be a no-op
    slot = toBeHex(slot); // canonicalize slot since RPC is picky
    return this.cache.get(`${target}:${slot}`, async () => {
      const value = await this.provider.getStorage(target, slot, this.block);
      if (isNonzeroHex(value)) {
        // => code exists => is contract => non-null storage trie
        this.cache.add(target, true);
      }
      return value;
    });
  }
  async getProof(
    target: HexString,
    slots: BigNumberish[]
  ): Promise<RPCEthGetProof> {
    // note: currently not cached
    return this.provider.send('eth_getProof', [
      target,
      slots.map((x) => toBeHex(x, 32)),
      this.block,
    ]);
  }
  async prove(
    outputs: Output[]
  ): Promise<
    [
      accountProofs: Proof[],
      stateProofs: [accountIndex: number, storageProofs: Proof[]][],
    ]
  > {
    // deduplicate accounts: [account, slot[]][] into {account => Set<slots>}
    type Bucket = Map<bigint, Proof | null> & { index: number; proof: Proof };
    const targets = new Map<HexString, Bucket>();
    const buckets = outputs.map((output) => {
      let bucket = targets.get(output.target);
      if (!bucket) {
        bucket = new Map() as Bucket;
        bucket.index = targets.size;
        targets.set(output.target, bucket);
      }
      output.slots.forEach((slot) => bucket.set(slot, null)); // placeholder
      return bucket;
    });
    // prove all slots for a specific account in one RPC
    // TODO: check eth_getProof limits
    // https://github.com/ethereum/go-ethereum/blob/9f96e07c1cf87fdd4d044f95de9c1b5e0b85b47f/internal/ethapi/api.go#L707
    // 20240501: no limit, just response size
    await Promise.all(
      Array.from(targets, async ([target, bucket]) => {
        const slots = [...bucket.keys()]; // order doesn't matter
        const proof = await this.getProof(target, slots);
        bucket.proof = proof.accountProof;
        slots.forEach((slot, i) =>
          bucket.set(slot, proof.storageProof[i].proof)
        ); // replace placeholder
      })
    );
    // note: duplicate [account, slot]-pairs not not deduplicated but unlikely in practice
    return [
      // ordered account proofs
      Array.from(targets.values(), (x) => x.proof),
      // ordered storage proofs, where index into account proofs
      outputs.map((output, i) => {
        const bucket = buckets[i];
        return [bucket.index, output.slots.map((x) => bucket.get(x) as Proof)]; // ordered storage proofs per account
      }),
    ];
  }
  async execute(req: EVMRequest) {
    return EVMProver.resolved(await this.eval(req.ops, req.inputs));
  }
  async eval(ops: Uint8Array, inputs: HexString[]) {
    let pos = 1; // skip # outputs
    let slot = 0n;
    let target: HexString = ZeroAddress;
    const outputs: Resolvable<Output>[] = [];
    const stack: Resolvable<HexString>[] = [];
    const readByte = () => {
      const op = ops[pos++];
      if (pos > ops.length) throw new Error('op overflow');
      return op;
    };
    const popStack = () => {
      if (!stack.length) throw new Error('stack underflow');
      return stack.pop()!;
    };
    outer: while (pos < ops.length) {
      const op = readByte();
      try {
        switch (op) {
          case OP_TARGET: {
            target = addressFromHex(await popStack());
            slot = 0n;
            break;
          }
          case OP_TARGET_FIRST: {
            let exists;
            while (stack.length && !exists) {
              target = addressFromHex(await popStack());
              outputs.push({
                target,
                slots: [],
                hidden: true,
                async value() {
                  return '';
                },
              });
              exists = await this.getExists(target);
            }
            if (!exists) break outer;
            stack.length = 0;
            slot = 0n;
            break;
          }
          case OP_COLLECT: {
            outputs.push(this.createOutput(target, slot, readByte()));
            slot = 0n;
            break;
          }
          case OP_COLLECT_RANGE: {
            const length = readByte();
            outputs.push(
              this.createOutputFromSlots(
                target,
                Array.from({ length }, (_, i) => slot + BigInt(i))
              )
            );
            slot = 0n;
            break;
          }
          case OP_COLLECT_FIRST: {
            const step = readByte();
            while (stack.length) {
              // TODO: make this parallel or batched?
              const output = await this.createOutput(
                target,
                uint256FromHex(await popStack()),
                step
              );
              outputs.push(output);
              if (output.size && isNonzeroHex(await output.value())) break;
              output.hidden = stack.length > 0;
            }
            stack.length = 0;
            slot = 0n;
            break;
          }
          case OP_PUSH_INPUT: {
            const i = readByte();
            if (i >= inputs.length)
              throw new Error(`invalid input index: ${i}`);
            stack.push(inputs[i]);
            break;
          }
          case OP_PUSH_OUTPUT: {
            const i = readByte();
            if (i >= outputs.length)
              throw new Error(`invalid output index: ${i}`);
            stack.push(Promise.resolve(outputs[i]).then((x) => x.value()));
            break;
          }
          case OP_PUSH_STACK: {
            const i = readByte();
            if (i >= stack.length) throw new Error(`invalid stack index: ${i}`);
            stack.push(stack[stack.length - 1 - i]);
            break;
          }
          case OP_PUSH_SLOT: {
            stack.push(toBeHex(slot, 32));
            // TODO: should this reset slot?
            break;
          }
          case OP_PUSH_TARGET: {
            stack.push(target);
            break;
          }
          case OP_SLOT_ADD: {
            slot += uint256FromHex(await popStack());
            break;
          }
          case OP_SLOT_SET: {
            slot = uint256FromHex(await popStack());
            break;
          }
          case OP_SLOT_FOLLOW: {
            slot = BigInt(
              keccak256(concat([await popStack(), toBeHex(slot, 32)]))
            );
            break;
          }
          case OP_STACK_KECCAK: {
            stack.push(keccak256(await popStack()));
            break;
          }
          case OP_STACK_CONCAT: {
            const n = readByte();
            stack.splice(
              Math.max(0, stack.length - n),
              n,
              n ? concat(await Promise.all(stack.slice(-n))) : '0x'
            );
            break;
          }
          case OP_STACK_SLICE: {
            const x = readByte();
            const n = readByte();
            stack.push(dataSlice(await popStack(), x, x + n));
            break;
          }
          case OP_STACK_FIRST: {
            let first = '0x';
            while (stack.length) {
              const value = await popStack();
              if (isNonzeroHex(value)) {
                first = value;
                break;
              }
            }
            stack.length = 0;
            stack.push(first);
            break;
          }
          default:
            throw new Error('unknown op');
        }
      } catch (err) {
        Object.assign(err!, {
          ops,
          inputs,
          state: { op, pos, target, slot, stack },
        });
        throw err;
      }
    }
    return Promise.all(outputs);
  }
  checkSize(size: bigint | number) {
    if (size > this.maxBytes)
      throw Object.assign(new Error('overflow: size'), {
        size,
        max: this.maxBytes,
      });
    return Number(size);
  }
  async createOutput(
    target: HexString,
    slot: bigint,
    step: number
  ): Promise<Output> {
    //console.log({target, slot, step});
    const first = await this.getStorage(target, slot);
    if (step == 0) {
      // bytes32
      const p = Promise.resolve(first);
      return {
        target,
        size: first ? 32 : 0, // size is falsy on zero
        slots: [slot],
        value: () => p,
      };
    } else if (step == STEP_BYTES) {
      let size = parseInt(first.slice(64), 16); // last byte
      if ((size & 1) == 0) {
        // small
        size >>= 1;
        const p = Promise.resolve(dataSlice(first, 0, size));
        return {
          target,
          size,
          slots: [slot],
          value: () => p,
        };
      } else {
        size = this.checkSize(BigInt(first) >> 1n);
        const offset = BigInt(solidityPackedKeccak256(['uint256'], [slot]));
        const slots = [
          slot,
          ...Array.from(
            { length: (size + 31) >> 5 },
            (_, i) => offset + BigInt(i)
          ),
        ];
        const output = {
          parent: this,
          target,
          slots,
          size,
          value() {
            const p = Promise.all(
              this.slots
                .slice(1)
                .map((x) => this.parent.getStorage(this.target, x))
            ).then((v) => {
              return dataSlice(concat(v), 0, this.size);
            });
            this.value = () => p;
            return p;
          },
        };
        return output;
      }
    } else {
      let length = this.checkSize(BigInt(first));
      if (step < 32) {
        const per = (32 / step) | 0;
        length = ((length + per - 1) / per) | 0;
      } else {
        length = length * ((step + 31) >> 5);
      }
      const offset = BigInt(solidityPackedKeccak256(['uint256'], [slot]));
      const slots = [
        slot,
        ...Array.from({ length }, (_, i) => offset + BigInt(i)),
      ];
      // let output = {
      // 	parent: this,
      // 	target,
      // 	slots,
      // 	size,
      // 	value() {
      // 		let p = Promise.all(this.slots.map(x => this.parent.getStorage(this.target, x))).then(concat);
      // 		this.value = () => p;
      // 		return p;
      // 	}
      // };
      // return output;
      return this.createOutputFromSlots(target, slots);
    }
  }
  createOutputFromSlots(target: HexString, slots: bigint[]): Output {
    const size = this.checkSize(slots.length << 5);
    const output = {
      parent: this,
      target,
      slots,
      size,
      value() {
        const p = Promise.all(
          this.slots.map((x) => this.parent.getStorage(this.target, x))
        ).then(concat);
        this.value = () => p;
        return p;
      },
    };
    return output;
  }
}
