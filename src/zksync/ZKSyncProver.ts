import type {
  Provider,
  HexAddress,
  HexString,
  ProofRef,
  ProofSequence,
} from '../types.js';
import {
  type RPCZKSyncGetProof,
  type ZKSyncStorageProof,
  encodeProof,
} from './types.js';
import {
  AbstractProver,
  isTargetNeed,
  makeStorageKey,
  type Need,
} from '../vm.js';
import { ZeroAddress } from 'ethers/constants';
import { toPaddedHex, withResolvers } from '../utils.js';
import { unwrap } from '../wrap.js';

// https://docs.zksync.io/build/api-reference/zks-rpc#zks_getproof
// https://github.com/matter-labs/era-contracts/blob/fd4aebcfe8833b26e096e87e142a5e7e4744f3fa/system-contracts/bootloader/bootloader.yul#L458
export const ZKSYNC_ACCOUNT_CODEHASH =
  '0x0000000000000000000000000000000000008002';

// zksync proofs are relative to a *batch* not a *block*
export class ZKSyncProver extends AbstractProver {
  static readonly encodeProof = encodeProof;
  static async latest(provider: Provider) {
    return new this(
      provider,
      Number(await provider.send('zks_L1BatchNumber', []))
    );
  }
  constructor(
    provider: Provider,
    readonly batchIndex: number
  ) {
    super(provider);
  }
  override async isContract(target: HexAddress): Promise<boolean> {
    const storageProof: ZKSyncStorageProof | undefined =
      await this.proofLRU.touch(target.toLowerCase());
    const codeHash = storageProof
      ? storageProof.value
      : await this.getStorage(ZKSYNC_ACCOUNT_CODEHASH, BigInt(target));
    return !/^0x0+$/.test(codeHash);
  }
  override async getStorage(
    target: HexAddress,
    slot: bigint,
    fast?: boolean
  ): Promise<HexString> {
    target = target.toLowerCase();
    const storageKey = makeStorageKey(target, slot);
    const storageProof: ZKSyncStorageProof | undefined =
      await this.proofLRU.touch(storageKey);
    if (storageProof) {
      return storageProof.value;
    }
    if (fast || this.fast) {
      return this.cache.get(storageKey, () => {
        return this.provider.getStorage(target, slot);
      });
    }
    const vs = await this.getStorageProofs(target, [slot]);
    return vs[0].value;
  }
  override async prove(needs: Need[]): Promise<ProofSequence> {
    const promises: Promise<void>[] = [];
    const buckets = new Map<HexAddress, Map<bigint, ProofRef>>();
    const refs: ProofRef[] = [];
    let nullRef: ProofRef | undefined;
    const createRef = () => {
      const ref = { id: refs.length, proof: '0x' };
      refs.push(ref);
      return ref;
    };
    const addSlot = (target: HexAddress, slot: bigint) => {
      if (target === ZeroAddress) return (nullRef ??= createRef());
      let bucket = buckets.get(target);
      if (!bucket) {
        bucket = new Map();
        buckets.set(target, bucket);
      }
      let ref = bucket.get(slot);
      if (!ref) {
        ref = createRef();
        bucket.set(slot, ref);
      }
      return ref;
    };
    let target = ZeroAddress;
    const order = needs.map((need) => {
      if (isTargetNeed(need)) {
        // codehash for contract A is not stored in A
        // it is stored in the global codehash contract
        target = need.target;
        return addSlot(
          need.required ? ZKSYNC_ACCOUNT_CODEHASH : ZeroAddress,
          BigInt(need.target)
        );
      } else if (typeof need === 'bigint') {
        return addSlot(target, need);
      } else {
        const ref = createRef();
        promises.push(
          (async () => {
            ref.proof = await unwrap(need.value);
          })()
        );
        return ref;
      }
    });
    this.checkProofCount(refs.length);
    await Promise.all(
      promises.concat(
        Array.from(buckets, async ([target, map]) => {
          const m = [...map];
          const proofs = await this.getStorageProofs(
            target,
            m.map(([slot]) => slot)
          );
          m.forEach(([, ref], i) => (ref.proof = encodeProof(proofs[i])));
        })
      )
    );
    return {
      proofs: refs.map((x) => x.proof),
      order: Uint8Array.from(order, (x) => x.id),
    };
  }
  async getStorageProofs(target: HexString, slots: bigint[]) {
    target = target.toLowerCase();
    const missing: number[] = [];
    const { promise, resolve, reject } = withResolvers();
    const storageProofs: (
      | Promise<ZKSyncStorageProof>
      | ZKSyncStorageProof
      | undefined
    )[] = slots.map((slot, i) => {
      const key = makeStorageKey(target, slot);
      const p = this.proofLRU.touch(key);
      if (!p) {
        this.proofLRU.setFuture(
          key,
          promise.then(() => storageProofs[i])
        );
        missing.push(i);
      }
      return p;
    });
    if (missing.length) {
      try {
        const vs = await this.fetchStorageProofs(
          target,
          missing.map((x) => slots[x])
        );
        missing.forEach((x, i) => (storageProofs[x] = vs[i]));
        resolve();
      } catch (err) {
        reject(err);
        throw err;
      }
    }
    return Promise.all(storageProofs) as Promise<ZKSyncStorageProof[]>;
  }
  async fetchStorageProofs(
    target: HexString,
    slots: bigint[]
  ): Promise<ZKSyncStorageProof[]> {
    const ps: Promise<RPCZKSyncGetProof>[] = [];
    for (let i = 0; i < slots.length; ) {
      ps.push(
        this.provider.send('zks_getProof', [
          target,
          slots
            .slice(i, (i += this.proofBatchSize))
            .map((slot) => toPaddedHex(slot)),
          this.batchIndex,
        ])
      );
    }
    const vs = await Promise.all(ps);
    return vs.flatMap((x) => x.storageProof);
  }
}
