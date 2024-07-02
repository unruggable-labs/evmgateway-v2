import type {HexString, BytesLike, BigNumberish, Provider, RPCEthGetProof, RPCEthGetBlock, Proof} from './types.js';
import {ethers} from 'ethers';
import {unwrap, Wrapped, type Unwrappable} from './wrap.js';
import {CachedMap} from './cached.js';

type HexFuture = Unwrappable<HexString>;

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

// maximum number of items on stack
// the following should be equivalent to EVMProtocol.sol
export const MAX_STACK = 64;

// maximum number of bytes from single read()
// this is also constrained by proof count (1 proof per 32 bytes)
export const MAX_READ_BYTES = 32*32;

 // maximum number of targets
export const MAX_UNIQUE_TARGETS = 32;

// maximum number of proofs (M account + N storage, max 256)
// if this number is too small, protocol can be changed to uint16
export const MAX_UNIQUE_PROOFS = 128;

// OP_EVAL flags
// the following should be equivalent to EVMProtocol.sol
const STOP_ON_SUCCESS = 1;
const STOP_ON_FAILURE = 2;
const ACQUIRE_STATE = 4;

// EVMRequest operations
// specific ids just need to be unique
// the following should be equivalent to EVMProtocol.sol
const OP_DEBUG = 255; // experimental
const OP_TARGET = 1;
const OP_SET_OUTPUT = 2;
const OP_EVAL = 3;

const OP_REQ_NONZERO = 10;
const OP_REQ_CONTRACT = 11;

const OP_READ_SLOTS = 20;
const OP_READ_BYTES = 21;
const OP_READ_ARRAY = 22;

const OP_SLOT_ZERO = 30;
const OP_SLOT_ADD = 31;
const OP_SLOT_FOLLOW = 32;

const OP_PUSH_INPUT = 40;
const OP_PUSH_OUTPUT = 41;
const OP_PUSH_SLOT = 42;
const OP_PUSH_TARGET = 43;

const OP_DUP = 50;
const OP_POP = 51;

const OP_KECCAK = 60;
const OP_CONCAT = 61;
const OP_SLICE = 62;

const NULL_CODE_HASH = ethers.id('');
const ACCOUNT_PROOF_PH = -1n;

function uint256FromHex(hex: string) {
	// the following should be equivalent to EVMProofHelper.toUint256()
	return hex === '0x' ? 0n : BigInt(hex.slice(0, 66));
}
function addressFromHex(hex: string) {
	// the following should be equivalent to: address(uint160(ProofUtils.uint256FromBytes(x)))
	return '0x' + (hex.length >= 66 ? hex.slice(26, 66) : hex.slice(2).padStart(40, '0').slice(-40)).toLowerCase();
}
function bigintRange(start: bigint, length: number) {
	return Array.from({length}, (_, i) => start + BigInt(i));
}
function solidityArraySlots(slot: BigNumberish, length: number) {
	return length ? bigintRange(BigInt(ethers.solidityPackedKeccak256(['uint256'], [slot])), length) : [];
}
export function solidityFollowSlot(slot: BigNumberish, key: BytesLike) {
	// https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#mappings-and-dynamic-arrays
	return BigInt(ethers.keccak256(ethers.concat([key, ethers.toBeHex(slot, 32)])));
}

// read an EVMCommand ops buffer
export class CommandReader {
	static fromCommand(cmd: EVMCommand) {
		return new this(Uint8Array.from(cmd.ops), cmd.inputs.slice());
	}
	static fromEncoded(hex: HexString) {
		let [ops, inputs] = ABI_CODER.decode(['bytes', 'bytes[]'], hex);
		return new this(ethers.getBytes(ops), [...inputs]);
	}
	pos: number = 0;
	constructor(readonly ops: Uint8Array, readonly inputs: HexString[]) {
		this.ops = ops;
		this.inputs = inputs;
	}
	get remaining() {
		return this.ops.length - this.pos;
	}
	checkRead(n: number) {
		if (this.pos + n > this.ops.length) throw new Error('reader overflow');
	}
	readByte() {
		this.checkRead(1);
		return this.ops[this.pos++];
	}
	readShort() {
		return (this.readByte() << 8) | this.readByte();
	}
	readBytes() {
		let n = this.readShort();
		this.checkRead(n);
		return ethers.hexlify(this.ops.subarray(this.pos, this.pos += n));
	}
	readInput() {
		let i = this.readByte();
		if (i >= this.inputs.length) throw new Error(`invalid input index: ${i}`);
		return this.inputs[i];
	}
}

export class EVMCommand {	
	constructor(
		private parent: EVMCommand | undefined = undefined,
		readonly ops: number[] = [],
		readonly inputs: string[] = [],
	) {}
	clone() {
		return new EVMCommand(this.parent, this.ops.slice(), this.inputs.slice());
	}
	protected addByte(x: number) {
		if ((x & 0xFF) !== x) throw new Error(`expected byte: ${x}`);
		this.ops.push(x);
		return this;
	}
	protected addShort(x: number) {
		//return this.addByte(x >> 8).addByte(x & 0xFF);
		if ((x & 0xFFFF) !== x) throw new Error(`expected short: ${x}`);
		this.ops.push(x >> 8, x & 0xFF);
		return this;
	}
	protected addInputStr(s: string) { return this.addInputBytes(ethers.toUtf8Bytes(s)); }
	protected addInputBytes(v: BytesLike) {
		let hex = ethers.hexlify(v);
		let i = this.inputs.length;
		this.inputs.push(hex); // note: no check, but blows up at 256
		return i;
	}
	encode() {
		return ABI_CODER.encode(['bytes', 'bytes[]'], [Uint8Array.from(this.ops), this.inputs]);
	}
	debug(label = '') { return this.addByte(OP_DEBUG).addByte(this.addInputStr(label)); }

	read(n = 1) { return this.addByte(OP_READ_SLOTS).addByte(n); }
	readBytes() { return this.addByte(OP_READ_BYTES); }
	readArray(step: number) { return this.addByte(OP_READ_ARRAY).addShort(step); }

	target() { return this.addByte(OP_TARGET); }
	setOutput(i: number) { return this.addByte(OP_SET_OUTPUT).addByte(i); }
	eval(opts: {
		success?: boolean;
		failure?: boolean;
		acquire?: boolean;
		back?: number;
	} = {}) {
		let flags = 0;
		if (opts.success) flags |= STOP_ON_SUCCESS;
		if (opts.failure) flags |= STOP_ON_FAILURE;
		if (opts.acquire) flags |= ACQUIRE_STATE;
		return this.addByte(OP_EVAL).addByte(opts.back ?? 255).addByte(flags);
	}

	zeroSlot() { return this.addByte(OP_SLOT_ZERO); }
	addSlot() { return this.addByte(OP_SLOT_ADD); }
	follow() { return this.addByte(OP_SLOT_FOLLOW); }

	requireContract() { return this.addByte(OP_REQ_CONTRACT); }
	requireNonzero(back = 0) { return this.addByte(OP_REQ_NONZERO).addByte(back); }

	pop() { return this.addByte(OP_POP); }
	dup(back = 0) { return this.addByte(OP_DUP).addByte(back); }
	
	pushOutput(i: number) { return this.addByte(OP_PUSH_OUTPUT).addByte(i); }
	pushInput(i: number) { return this.addByte(OP_PUSH_INPUT).addByte(i); }
	push(x: BigNumberish) { return this.pushBytes(ethers.toBeHex(x, 32)); }
	pushStr(s: string) { return this.addByte(OP_PUSH_INPUT).addByte(this.addInputStr(s)); }
	pushBytes(v: BytesLike) { return this.addByte(OP_PUSH_INPUT).addByte(this.addInputBytes(v)); }
	//pushCommand(cmd: EVMCommand) { return this.pushBytes(cmd.encode()); }
	pushSlot() { return this.addByte(OP_PUSH_SLOT); }
	pushTarget() { return this.addByte(OP_PUSH_TARGET); }
	
	concat(back: number) { return this.addByte(OP_CONCAT).addByte(back); }
	keccak() { return this.addByte(OP_KECCAK); }
	slice(x: number, n: number) { return this.addByte(OP_SLICE).addShort(x).addShort(n); }

	// experimental syntax
	// alternative: pushCommand()
	begin() { return new EVMCommand(this); }
	end() {
		let p = this.parent;
		if (!p) throw new Error('no parent');
		this.parent = undefined;
		p.pushBytes(this.encode());
		return p;
	}

	// shorthands?
	offset(x: BigNumberish) { return this.push(x).addSlot(); }
	setTarget(x: HexString) { return this.push(x).target(); }
	setSlot(x: BigNumberish) { return this.zeroSlot().offset(x); }
}

// a request is just a command where the leading byte is the number of outputs
export class EVMRequest extends EVMCommand {
	context: HexString | undefined;
	constructor(outputCount = 0) {
		super(undefined);
		this.addByte(outputCount);
	}
	get outputCount() {
		return this.ops[0];
	}
	// convenience for writing JS-based requests
	// (this functionality is not available in solidity)
	addOutput() {
		let i = this.ops[0];
		if (i == 0xFF) throw new Error('output overflow');
		this.ops[0] = i + 1;
		return this.setOutput(i);
	}
	// experimential
	// evaluate a request inline
	// if no data is required (pure computation) no provider is required
	async resolveWith(prover = new EVMProver(undefined as unknown as Provider, '0x')) {
		let state = await prover.evalRequest(this);
		return state.resolveOutputs();
	}
}

export type Need = [target: HexString, slot: bigint];

// tracks the state of an EVMCommand evaluation
// registers: [slot, target, stack]
// outputs are shared across eval()
// needs records sequence of necessary proofs
export class MachineState {
	static create(outputCount: number) {
		return new this(Array(outputCount).fill('0x'), []);
	}
	target = ethers.ZeroAddress;
	slot = 0n;
	stack: HexFuture[] = [];
	exitCode = 0;
	private readonly targetSet = new Set();
	constructor(
		readonly outputs: HexFuture[],
		readonly needs: Need[]
	) {}
	push(value: HexFuture) {
		if (this.stack.length == MAX_STACK) throw new Error('stack overflow');
		this.stack.push(value);
	}
	pop() {
		if (!this.stack.length) throw new Error('stack underflow');
		return this.stack.pop()!;
	}
	popSlice(back: number) {
		return back > 0 ? this.stack.splice(-back) : [];
	}
	peek(back: number) {
		return back < this.stack.length ? this.stack[this.stack.length-1-back] : '0x';
	}
	checkOutputIndex(i: number) {
		if (i >= this.outputs.length) throw new Error(`invalid output index: ${i}`);
		return i;
	}
	async resolveOutputs() {
		return Promise.all(this.outputs.map(unwrap));
	}
	traceTarget(target: HexString) {
		this.needs.push([target, ACCOUNT_PROOF_PH]); // special value indicate accountProof instead of slot
		this.targetSet.add(target);
		if (this.targetSet.size > MAX_UNIQUE_TARGETS) {
			throw new Error('too many targets');
		}
	}
	traceSlot(target: HexString, slot: bigint) {
		this.needs.push([target, slot]);
	}
	traceSlots(target: HexString, slots: bigint[]) {
		for (let slot of slots) {
			this.traceSlot(target, slot);
		}
	}
}

type AccountProof = Omit<RPCEthGetProof, 'storageProof'>;
type StorageProof = RPCEthGetProof['storageProof'][0];

function makeSlotKey(target: HexString, slot: bigint) {
	return `${target}:${slot.toString(16)}`;
}
function isContract(proof: AccountProof) {
	return !(proof.codeHash === NULL_CODE_HASH || proof.keccakCodeHash === NULL_CODE_HASH);
}

export class EVMProver {
	static async latest(provider: Provider) {
		let block = await provider.getBlockNumber(); 
		return new this(provider, '0x' + block.toString(16));
	}
	constructor(
		readonly provider: Provider, 
		readonly block: HexString, 
		readonly cache: CachedMap<string,any> = new CachedMap()
	) {}
	async cachedMap() {
		let map = new Map<HexString, any[]>();
		for (let key of this.cache.cachedKeys()) {
			let value = await this.cache.cachedValue(key);
			let target = key.slice(0, 42);
			let bucket = map.get(target);
			if (!bucket) {
				bucket = [];
				map.set(target, bucket);
			}
			if (key.length == 42) {
				//bucket.push(isContract(value as AccountProof));
			} else {
				bucket.push(BigInt((value as StorageProof).key));
			}
		}
		return map;
	}
	checkSize(size: bigint | number) {
		if (size > MAX_READ_BYTES) throw new Error(`too many bytes: ${size} > ${MAX_READ_BYTES}`);
		return Number(size);
	}
	async fetchStateRoot() {
		// this is just a convenience
		let block = await this.provider.send('eth_getBlockByNumber', [this.block, false]) as RPCEthGetBlock;
		return block.stateRoot;
	}
	async fetchProofs(target: HexString, slots: bigint[] = []): Promise<RPCEthGetProof> {
		// 20240501: check geth slot limit => no limit, just response size
		// https://github.com/ethereum/go-ethereum/blob/9f96e07c1cf87fdd4d044f95de9c1b5e0b85b47f/internal/ethapi/api.go#L707
		//console.log('getProof', target, slots);
		// TODO: chunk this by 32s or something
		return this.provider.send('eth_getProof', [target, slots.map(slot => ethers.toBeHex(slot, 32)), this.block]);
	}
	async getProofs(target: HexString, slots: bigint[] = []): Promise<RPCEthGetProof> {
		target = target.toLowerCase();
		let missing: number[] = [];
		let {promise, resolve} = Promise.withResolvers(); // create a blocker
		try {
			let accountProof: Promise<AccountProof> | AccountProof | undefined = this.cache.cachedValue(target);
			if (!accountProof) {
				this.cache.set(target, promise.then(() => this.cache.cachedValue(target))); // block
			}
			let storageProofs: (Promise<StorageProof> | StorageProof | undefined)[] = slots.map((slot, i) => {
				let key = makeSlotKey(target, slot);
				let p = this.cache.cachedValue(key);
				if (!p) {
					this.cache.set(key, promise.then(() => this.cache.cachedValue(key))); // block
					missing.push(i);
				}
				return p;
			});
			if (!accountProof || missing.length) {
				let {storageProof: v, ...a} = await this.fetchProofs(target, missing.map(i => slots[i]));
				this.cache.set(target, accountProof = a);
				missing.forEach((j, i) => {
					this.cache.set(makeSlotKey(target, slots[j]), storageProofs[j] = v[i]);
				});
			}
			return {
				...await accountProof as AccountProof, 
				storageProof: await Promise.all(storageProofs) as StorageProof[]
			};
		} finally {
			resolve(); // unblock
		}
	}
	async getStorage(target: HexString, slot: bigint): Promise<HexString> {
		try {
			// check to see if we know this target isn't a contract without invoking provider
			let accountProof: AccountProof | undefined = await this.cache.cachedValue(target);
			if (accountProof && !isContract(accountProof)) {
				return ethers.ZeroHash;
			}
		} catch (err) {
		}
		let storageProof: StorageProof = await this.cache.get(makeSlotKey(target, slot), async () => {
			let proofs = await this.getProofs(target, [slot]);
			return proofs.storageProof[0];
		});
		return ethers.toBeHex(storageProof.value, 32);
	}
	async isContract(target: HexString): Promise<boolean> {
		return isContract(await this.getProofs(target, []));
	}
	async prove(needs: Need[]) {
		// reduce an ordered list of needs into a deduplicated list of proofs
		// minimize calls to eth_getProof
		// provide empty proofs for non-contract slots
		type Ref = {id: number, proof: Proof};
		type RefMap = Ref & {map: Map<bigint, Ref>};
		let targets = new Map<HexString, RefMap>();
		let refs: Ref[] = [];
		let order = needs.map(([target, slot]) => {
			let bucket = targets.get(target);
			if (slot == ACCOUNT_PROOF_PH) {
				// accountProof
				if (!bucket) {
					bucket = {id: refs.length, proof: [], map: new Map()};
					refs.push(bucket);
					targets.set(target, bucket);
				}
				return bucket.id;
			} else {
				// storageProof (for targeted account)
				// bucket can be undefined if a slot is read without a target
				// this is okay because the initial machine state is NOT_A_CONTRACT
				let ref = bucket?.map.get(slot);
				if (!ref) {
					ref = {id: refs.length, proof: []};
					refs.push(ref);
					bucket?.map.set(slot, ref);
				}
				return ref.id;
			}
		});
		if (refs.length > MAX_UNIQUE_PROOFS) {
			throw new Error(`too many proofs: ${refs.length} > ${MAX_UNIQUE_PROOFS}`);
		}
		await Promise.all(Array.from(targets, async ([target, bucket]) => {
			let m = [...bucket.map];
			try {
				let accountProof: AccountProof | undefined = await this.cache.cachedValue(target);
				if (accountProof && !isContract(accountProof)) {
					m = []; // if we know target isn't a contract, we only need accountProof
				}
			} catch (err) {
			}
			let proofs = await this.getProofs(target, m.map(([slot]) => slot));
			bucket.proof = proofs.accountProof;
			if (isContract(proofs)) {
				m.forEach(([_, ref], i) => ref.proof = proofs.storageProof[i].proof);
			}
		}));
		return {
			proofs: refs.map(x => x.proof),
			order: Uint8Array.from(order)
		};
	}
	async evalDecoded(ops: HexString, inputs: HexString[]) {
		return this.evalReader(new CommandReader(ethers.getBytes(ops), inputs));
	}
	async evalRequest(req: EVMRequest) {
		return this.evalReader(CommandReader.fromCommand(req));
	}
	async evalReader(reader: CommandReader) {
		let vm = MachineState.create(reader.readByte());
		await this.evalCommand(reader, vm);
		return vm;
	}
	async evalCommand(reader: CommandReader, vm: MachineState) {
		while (reader.remaining) {
			let op = reader.readByte();
			switch (op) {
				case OP_DEBUG: { // args: [string(label)] / stack: 0
					console.log('DEBUG', ethers.toUtf8String(reader.readInput()), {
						target: vm.target,
						slot: vm.slot,
						exitCode: vm.exitCode,
						stack: await Promise.all(vm.stack.map(unwrap)),
						outputs: await vm.resolveOutputs(),
						needs: vm.needs,
					});
					continue;
				}
				case OP_TARGET: { // args: [] / stack: -1
					vm.target = addressFromHex(await unwrap(vm.pop()));
					vm.slot = 0n;
					vm.traceTarget(vm.target); // accountProof
					continue;
				}
				case OP_SLOT_ADD: { // args: [] / stack: -1
					vm.slot += uint256FromHex(await unwrap(vm.pop()));
					continue;
				}
				case OP_SLOT_ZERO: { // args: [] / stack: 0
					vm.slot = 0n;
					continue;
				}
				case OP_SET_OUTPUT: { // args: [outputIndex] / stack: -1
					vm.outputs[vm.checkOutputIndex(reader.readByte())] = vm.pop();
					continue;
				}
				case OP_PUSH_INPUT: { // args: [inputIndex] / stack: 0
					vm.push(reader.readInput());
					continue;
				}
				case OP_PUSH_OUTPUT: { // args: [outputIndex] / stack: +1
					vm.push(vm.outputs[vm.checkOutputIndex(reader.readByte())]);
					continue;
				}
				case OP_PUSH_SLOT: { // args: [] / stack: +1
					vm.push(ethers.toBeHex(vm.slot, 32)); // current slot register
					continue;
				}
				case OP_PUSH_TARGET: { // args: [] / stack: +1
					vm.push(vm.target); // current target address
					continue;
				}
				case OP_DUP: { // args: [stack(rindex)] / stack: +1
					vm.push(vm.peek(reader.readByte()));
					continue;
				}	
				case OP_POP: { // args: [] / stack: upto(-1)
					vm.stack.pop();
					continue;
				}
				case OP_READ_SLOTS: { // args: [count] / stack: +1
					let {target, slot} = vm;
					let count = reader.readByte();
					this.checkSize(count << 5);
					let slots = bigintRange(slot, count);
					vm.traceSlots(target, slots);
					vm.push(slots.length ? new Wrapped(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))) : '0x');
					continue;
				}
				case OP_READ_BYTES: { // args: [] / stack: +1
					// https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#bytes-and-string
					let {target, slot} = vm;
					vm.traceSlot(target, slot);
					let first = await this.getStorage(target, slot);
					let size = parseInt(first.slice(64), 16); // last byte
					if ((size & 1) == 0) { // small
						vm.push(ethers.dataSlice(first, 0, size >> 1));
					} else {
						size = this.checkSize(BigInt(first) >> 1n);
						let slots = solidityArraySlots(slot, (size + 31) >> 5);
						vm.traceSlots(target, slots);
						vm.push(new Wrapped(async () => ethers.dataSlice(ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x)))), 0, size)));
					}
					continue;
				}
				case OP_READ_ARRAY: { // args: [] / stack: +1
					let step = reader.readShort();
					if (!step) throw new Error('invalid element size');
					let {target, slot} = vm;
					vm.traceSlot(target, slot);
					let length = this.checkSize(uint256FromHex(await this.getStorage(target, slot)));
					if (step < 32) {
						let per = 32 / step|0;
						length = (length + per - 1) / per|0;
					} else {
						length = length * ((step + 31) >> 5);
					}
					let slots = solidityArraySlots(slot, length);
					vm.traceSlots(target, slots);
					slots.unshift(slot);
					vm.push(new Wrapped(async () => ethers.concat(await Promise.all(slots.map(x => this.getStorage(target, x))))));
					continue;
				}
				case OP_REQ_CONTRACT: { // args: [] / stack: 0
					if (!await this.isContract(vm.target)) {
						vm.exitCode = 1;
						return;
					}
					continue;
				}
				case OP_REQ_NONZERO: { // args: [back] / stack: 0
					let back = reader.readByte();
					if (/^0x0*$/.test(await unwrap(vm.peek(back)))) {
						vm.exitCode = 1;
						return;
					}
					continue;
				}
				case OP_EVAL: { // args: [back, flags] / stack: -1 (program) & -back (args)
					let back = reader.readByte();
					let flags = reader.readByte();
					let cmd = CommandReader.fromEncoded(await unwrap(vm.pop()));
					let args = vm.popSlice(back).toReversed();
					let vm2 = new MachineState(vm.outputs, vm.needs);
					for (let arg of args) {
						vm2.target = vm.target;
						vm2.slot = vm.slot;
						vm2.stack = [arg];
						vm2.exitCode = 0;
						cmd.pos = 0;
						await this.evalCommand(cmd, vm2);
						if (flags & (vm2.exitCode ? STOP_ON_FAILURE : STOP_ON_SUCCESS)) break;
					}
					if (flags & ACQUIRE_STATE) {
						vm.target = vm2.target;
						vm.slot   = vm2.slot;
						vm.stack  = vm2.stack;
					}
					continue;
				}
				case OP_SLOT_FOLLOW: { // args: [] / stack: -1
					vm.slot = solidityFollowSlot(vm.slot, await unwrap(vm.pop()));
					continue;
				}
				case OP_KECCAK: { // args: [] / stack: 0
					vm.push(ethers.keccak256(await unwrap(vm.pop())));
					continue;
				}
				case OP_CONCAT: { // args: [back]
					//        stack = [a, b, c]
					// => concat(2) = [a, b+c]
					// => concat(4) = [a+b+c]
					// => concat(0) = [a, b, c, 0x]
					let v = vm.popSlice(reader.readByte());
					vm.push(v.length ? new Wrapped(async () => ethers.concat(await Promise.all(v.map(unwrap)))) : '0x');
					continue;
				}
				case OP_SLICE: { // args: [off, size] / stack: 0
					let x = reader.readShort();
					let n = reader.readShort();
					let v = await unwrap(vm.pop());
					if (x + n > (v.length-2)>>1) throw new Error('slice overflow');
					vm.push(ethers.dataSlice(v, x, x + n));
					continue;
				}
				default: throw new Error(`unknown op: ${op}`);
			}
		}
	}

}
