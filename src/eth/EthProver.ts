import type { HexAddress, HexString, ProofRef } from '../types.js';
import {
  type EthAccountProof,
  type EthStorageProof,
  type RPCEthGetProof,
  isContract,
  encodeProof,
} from './types.js';
import { BlockProver, makeStorageKey, type TargetNeed } from '../vm.js';
import { ZeroHash } from 'ethers/constants';
import { sendRetry, withResolvers, toPaddedHex } from '../utils.js';

export class EthProver extends BlockProver {
  static readonly encodeProof = encodeProof;
  static readonly isContract = isContract;
  proofRetryCount = 0;
  override async isContract(target: HexAddress) {
    target = target.toLowerCase();
    if (this.fast) {
      return this.cache.get(target, async () => {
        const code = await this.provider.getCode(target, this.block);
        return code.length > 2;
      });
    }
    return isContract(await this.getProofs(target));
  }
  override async getStorage(
    target: HexAddress,
    slot: bigint,
    fast?: boolean
  ): Promise<HexString> {
    target = target.toLowerCase();
    // check to see if we know this target isn't a contract without invoking provider
    // this is almost equivalent to: await isContract(target)
    const accountProof: EthAccountProof | undefined =
      await this.proofLRU.touch(target);
    if (accountProof && !isContract(accountProof)) {
      return ZeroHash;
    }
    // check to see if we've already have a proof for this value
    const storageKey = makeStorageKey(target, slot);
    const storageProof: EthStorageProof | undefined =
      await this.proofLRU.touch(storageKey);
    if (storageProof) {
      return toPaddedHex(storageProof.value);
    }
    if (fast || this.fast) {
      return this.cache.get(storageKey, () =>
        this.provider.getStorage(target, slot, this.block)
      );
    }
    const proofs = await this.getProofs(target, [slot]);
    return proofs.storageProof[0].value;
  }
  protected override async _proveNeed(
    need: TargetNeed,
    accountRef: ProofRef,
    slotRefs: Map<bigint, ProofRef>
  ) {
    const m = [...slotRefs];
    const accountProof: EthAccountProof | undefined = await this.proofLRU.peek(
      need.target
    );
    if (accountProof && !isContract(accountProof)) m.length = 0;
    const proofs = await this.getProofs(
      need.target,
      m.map(([slot]) => slot)
    );
    accountRef.proof = encodeProof(proofs.accountProof);
    if (isContract(proofs)) {
      m.forEach(
        ([, ref], i) => (ref.proof = encodeProof(proofs.storageProof[i].proof))
      );
    }
  }
  async getProofs(
    target: HexAddress,
    slots: bigint[] = []
  ): Promise<RPCEthGetProof> {
    target = target.toLowerCase();
    const missing: number[] = []; // indices of slots we don't have proofs for
    const { promise, resolve, reject } = withResolvers(); // create a blocker
    // 20240708: must setup blocks before await
    let accountProof: Promise<EthAccountProof> | EthAccountProof | undefined =
      this.proofLRU.touch(target);
    if (!accountProof) {
      // missing account proof, so block it
      this.proofLRU.setFuture(
        target,
        promise.then(() => accountProof)
      );
    }
    // check if we're missing any slots
    const storageProofs: (
      | Promise<EthStorageProof>
      | EthStorageProof
      | undefined
    )[] = slots.map((slot, i) => {
      const key = makeStorageKey(target, slot);
      const p = this.proofLRU.touch(key);
      if (!p) {
        // missing storage proof, so block it
        this.proofLRU.setFuture(
          key,
          promise.then(() => storageProofs[i])
        );
        missing.push(i);
      }
      return p;
    });
    // check if we need something
    if (!accountProof || missing.length) {
      try {
        const { storageProof: v, ...a } = await this.fetchProofs(
          target,
          missing.map((x) => slots[x])
        );
        // update cache
        accountProof = a;
        missing.forEach((x, i) => (storageProofs[x] = v[i]));
        resolve(); // unblock
      } catch (err) {
        reject(err);
        throw err;
      }
    }
    // reassemble
    const [a, v] = await Promise.all([
      accountProof,
      Promise.all(storageProofs),
    ]);
    return { storageProof: v as EthStorageProof[], ...a };
  }
  async fetchProofs(
    target: HexAddress,
    slots: bigint[] = []
  ): Promise<RPCEthGetProof> {
    const ps = [];
    for (let i = 0; ; ) {
      ps.push(
        sendRetry<RPCEthGetProof>(
          this.provider,
          'eth_getProof',
          [
            target,
            slots
              .slice(i, (i += this.proofBatchSize))
              .map((slot) => toPaddedHex(slot)),
            this.block,
          ],
          this.proofRetryCount
        )
      );
      if (i >= slots.length) break;
    }
    const vs = await Promise.all(ps);
    for (let i = 1; i < vs.length; i++) {
      vs[0].storageProof.push(...vs[i].storageProof);
    }
    return vs[0];
  }
}
