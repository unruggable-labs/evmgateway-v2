import type { JsonRpcApiProvider } from 'ethers/providers';
import type { BigNumberish, BytesLike } from 'ethers/utils';

export type { BigNumberish, BytesLike };
export type HexString = string;
export type HexString32 = HexString;
export type HexAddress = HexString;
export type EncodedProof = HexString;
export type ProofRef = { id: number; proof: EncodedProof };

export type Provider = JsonRpcApiProvider;
export type RawProvider = Pick<Provider, 'send'>;
export type ProviderPair = {
  provider1: Provider;
  provider2: Provider;
};

export type Chain = bigint;
export type ChainPair = {
  chain1: Chain;
  chain2: Chain;
};

export type ProofSequence = {
  readonly proofs: EncodedProof[];
  readonly order: Uint8Array;
};
export type ProofSequenceV1 = {
  readonly accountProof: EncodedProof;
  readonly storageProofs: EncodedProof[];
};

export type KeyOf<C, T> = {
  [K in keyof C]: C[K] extends T ? K : never;
}[keyof C];

export type Override<A, B> = Omit<A, keyof B> & B;
