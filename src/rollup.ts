import type {
  ChainPair,
  HexString,
  Provider,
  ProviderPair,
  ProofSequenceV1,
  ProofSequence,
  BigNumberish,
} from './types.js';
import type { AbstractProver } from './vm.js';

export type RollupDeployment<Config> = Readonly<ChainPair & Config>;

export type RollupCommit<P extends AbstractProver> = {
  readonly index: bigint;
  readonly prover: P;
};

export type Rollup = AbstractRollup<RollupCommit<AbstractProver>>;

export type RollupCommitType<R extends Rollup> = Parameters<
  R['fetchParentCommitIndex']
>[0];

export abstract class AbstractRollup<C extends RollupCommit<AbstractProver>> {
  // allows configuration of commit and prover
  // "expand LRU cache" => prover.proofLRU.maxCached = 1_000_000
  // "disable fast lookups" => prover.fast = false
  // "keep fast cache around longer" => prover.cache.cacheMs = Infinity
  // "limit targets" => prover.maxUniqueTargets = 1
  configure: (<T extends C>(commit: T) => void) | undefined;
  latestBlockTag: BigNumberish = 'finalized';
  getLogsStepSize = 1000;
  readonly provider1: Provider;
  readonly provider2: Provider;
  constructor(providers: ProviderPair) {
    this.provider1 = providers.provider1;
    this.provider2 = providers.provider2;
  }

  // abstract interface
  abstract fetchLatestCommitIndex(): Promise<bigint>;
  protected abstract _fetchParentCommitIndex(commit: C): Promise<bigint>;
  protected abstract _fetchCommit(index: bigint): Promise<C>;
  abstract encodeWitness(commit: C, proofSeq: ProofSequence): HexString;
  abstract windowFromSec(sec: number): number;

  // abstract wrappers
  async fetchParentCommitIndex(commit: C) {
    try {
      if (!commit.index) throw undefined;
      const index = await this._fetchParentCommitIndex(commit);
      if (index >= commit.index) throw new Error('bug');
      if (index < 0) throw undefined;
      return index;
    } catch (cause) {
      throw new Error(`no parent commit: ${commit.index}`, { cause });
    }
  }
  async fetchCommit(index: bigint) {
    try {
      const commit = await this._fetchCommit(index);
      this.configure?.(commit);
      return commit;
    } catch (cause) {
      throw new Error(`invalid commit: ${index}`, { cause });
    }
  }

  // convenience
  async fetchLatestCommit() {
    return this.fetchCommit(await this.fetchLatestCommitIndex());
  }
  async fetchParentCommit(commit: C) {
    return this.fetchCommit(await this.fetchParentCommitIndex(commit));
  }
  async fetchRecentCommits(count: number): Promise<C[]> {
    if (count < 1) return [];
    let commit = await this.fetchLatestCommit();
    const v = [commit];
    while (v.length < count && commit.index > 0) {
      commit = await this.fetchParentCommit(commit);
      v.push(commit);
    }
    return v;
  }
  get defaultWindow() {
    return this.windowFromSec(86400);
  }
}

export interface RollupWitnessV1<C extends RollupCommit<AbstractProver>> {
  encodeWitnessV1(commit: C, proofSeq: ProofSequenceV1): HexString;
}

export function supportsV1<R extends Rollup>(
  rollup: R
): rollup is R & RollupWitnessV1<RollupCommitType<R>> {
  return 'encodeWitnessV1' in rollup;
}
