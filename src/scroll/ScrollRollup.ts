import {
  AbstractRollupV1,
  type RollupCommit,
  type RollupDeployment,
} from '../rollup.js';
import type {
  HexAddress,
  HexString,
  HexString32,
  ProviderPair,
} from '../types.js';
import type { ProofSequence, ProofSequenceV1 } from '../vm.js';
import { Contract, concat, toBeHex } from 'ethers';
import { CHAINS } from '../chains.js';
import { EthProver } from '../eth/EthProver.js';
import { POSEIDON_ABI, ROLLUP_ABI, VERIFIER_ABI } from './types.js';
import { ABI_CODER, toString16 } from '../utils.js';

// https://github.com/scroll-tech/scroll-contracts/
// https://docs.scroll.io/en/developers/ethereum-and-scroll-differences/
// https://status.scroll.io/

export type ScrollConfig = {
  ScrollChainCommitmentVerifier: HexAddress;
  apiURL: string;
};

export type ScrollCommit = RollupCommit<EthProver> & {
  readonly finalTxHash: HexString32;
};

// 20240815: commits are approximately every minute
// to make caching useful, we align to a step
// note: use 1 to disable the alignment
//const commitStep = 15; // effectively minutes
// 20240827: finalization is only every ~15

export class ScrollRollup extends AbstractRollupV1<ScrollCommit> {
  // https://docs.scroll.io/en/developers/scroll-contracts/
  static readonly mainnetConfig: RollupDeployment<ScrollConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SCROLL,
    ScrollChainCommitmentVerifier: '0xC4362457a91B2E55934bDCb7DaaF6b1aB3dDf203',
    apiURL: 'https://mainnet-api-re.scroll.io/api/',
  };

  static readonly testnetConfig: RollupDeployment<ScrollConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.SCROLL_SEPOLIA,
    ScrollChainCommitmentVerifier: '0x64cb3A0Dcf43Ae0EE35C1C15edDF5F46D48Fa570',
    apiURL: 'https://sepolia-api-re.scroll.io/api/',
  };

  static async create(providers: ProviderPair, config: ScrollConfig) {
    const CommitmentVerifier = new Contract(
      config.ScrollChainCommitmentVerifier,
      VERIFIER_ABI,
      providers.provider1
    );
    const [rollupAddress, poseidonAddress]: HexAddress[] = await Promise.all([
      CommitmentVerifier.rollup(),
      CommitmentVerifier.poseidon(),
    ]);
    const rollup = new Contract(rollupAddress, ROLLUP_ABI, providers.provider1);
    const poseidon = new Contract(
      poseidonAddress,
      POSEIDON_ABI,
      providers.provider1
    );
    return new this(
      providers,
      CommitmentVerifier,
      config.apiURL,
      rollup,
      poseidon
    );
  }
  private constructor(
    providers: ProviderPair,
    readonly CommitmentVerifier: Contract,
    readonly apiURL: string,
    readonly rollup: Contract,
    readonly poseidon: Contract
  ) {
    super(providers);
  }

  async fetchAPILatestBatchIndex() {
    // we require the offchain indexer to map commit index to block
    // so we can use the same indexer to get the latest commit
    const res = await fetch(new URL('./last_batch_indexes', this.apiURL));
    if (!res.ok) throw new Error(`${res.url}: HTTP(${res.status})`);
    const json = await res.json();
    return BigInt(json.finalized_index);
  }
  async fetchAPIBatchIndexInfo(batchIndex: bigint) {
    const url = new URL('./batch', this.apiURL);
    url.searchParams.set('index', batchIndex.toString());
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.url}: HTTP(${res.status})`);
    const json = await res.json();
    const status: string = json.batch.rollup_status;
    const finalTxHash: HexString32 = json.batch.finalize_tx_hash;
    const l2BlockNumber = BigInt(json.batch.end_block_number);
    return { status, l2BlockNumber, finalTxHash };
  }
  async findFinalizedBatchIndexBefore(l1BlockNumber: bigint) {
    // for (let i = l1BlockNumber; i > 0; i -= this.getLogsStepSize) {
    //   const logs = await this.rollup.queryFilter(
    //     this.rollup.filters.FinalizeBatch(),
    //     i < this.getLogsStepSize ? 0n : i - this.getLogsStepSize,
    //     i - 1n
    //   );
    //   if (logs.length) {
    //     return BigInt(logs[logs.length - 1].topics[1]); // batchIndex
    //   }
    // }
    // throw new Error(`unable to find earlier batch: ${l1BlockNumber}`);
    // 20240830: this is more efficient
    return this.rollup.lastFinalizedBatchIndex({
      blockTag: l1BlockNumber - 1n,
    });
  }
  override async fetchLatestCommitIndex(): Promise<bigint> {
    // TODO: determine how to this w/o relying on indexer
    // note: this doesn't use latestBlockTag
    const [rpc, api] = await Promise.all([
      this.rollup.lastFinalizedBatchIndex({
        blockTag: this.latestBlockTag,
      }) as Promise<bigint>,
      this.fetchAPILatestBatchIndex(),
    ]);
    return rpc > api ? api : rpc;
  }
  protected override async _fetchParentCommitIndex(
    commit: ScrollCommit
  ): Promise<bigint> {
    // 20240826: this kinda sucks but it's the most efficient so far
    // alternative: helper contract, eg. loop finalizedStateRoots()
    // alternative: multicall, finalizedStateRoots looking for nonzero
    // [0, index] is finalized
    // https://github.com/scroll-tech/scroll/blob/738c85759d0248c005469972a49fc983b031ff1c/contracts/src/L1/rollup/ScrollChain.sol#L228
    // but not every state root is recorded
    // Differences[{310900, 310887, 310873, 310855}] => {13, 14, 18}
    const receipt = await this.provider1.getTransactionReceipt(
      commit.finalTxHash
    );
    if (!receipt) throw new Error(`no commit tx: ${commit.finalTxHash}`);
    return this.findFinalizedBatchIndexBefore(BigInt(receipt.blockNumber));
  }
  protected override async _fetchCommit(index: bigint): Promise<ScrollCommit> {
    const { status, l2BlockNumber, finalTxHash } =
      await this.fetchAPIBatchIndexInfo(index);
    if (status !== 'finalized') throw new Error(`not finalized: ${status}`);
    const prover = new EthProver(this.provider2, toString16(l2BlockNumber));
    return { index, prover, finalTxHash };
  }
  override encodeWitness(
    commit: ScrollCommit,
    proofSeq: ProofSequence
  ): HexString {
    return ABI_CODER.encode(
      ['uint256', 'bytes[]', 'bytes'],
      [commit.index, proofSeq.proofs, proofSeq.order]
    );
  }
  override encodeWitnessV1(
    commit: ScrollCommit,
    proofSeq: ProofSequenceV1
  ): HexString {
    const compressed = proofSeq.storageProofs.map((storageProof) =>
      concat([
        toBeHex(proofSeq.accountProof.length, 1),
        ...proofSeq.accountProof,
        toBeHex(storageProof.length, 1),
        ...storageProof,
      ])
    );
    return ABI_CODER.encode(
      ['tuple(uint256)', 'tuple(bytes, bytes[])'],
      [[commit.index], ['0x', compressed]]
    );
  }

  override windowFromSec(sec: number): number {
    // finalization time is not on-chain
    // https://etherscan.io/advanced-filter?eladd=0xa13baf47339d63b743e7da8741db5456dac1e556&eltpc=0x26ba82f907317eedc97d0cbef23de76a43dd6edb563bdb6e9407645b950a7a2d
    const span = 20; // every 10-20 batches
    const freq = 3600; // every hour?
    return span * Math.ceil(sec / freq); // units of batchIndex
  }
}