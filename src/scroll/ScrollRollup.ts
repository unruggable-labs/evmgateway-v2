import {
  type RollupCommit,
  type RollupDeployment,
  type RollupWitnessV1,
  AbstractRollup,
} from '../rollup.js';
import type {
  HexAddress,
  HexString,
  HexString32,
  ProviderPair,
  ProofSequence,
  ProofSequenceV1,
} from '../types.js';
import { Contract } from 'ethers/contract';
import { concat } from 'ethers/utils';
import { CHAINS } from '../chains.js';
import { EthProver } from '../eth/EthProver.js';
import { ROLLUP_ABI } from './types.js';
import { ABI_CODER, toPaddedHex } from '../utils.js';

// https://github.com/scroll-tech/scroll-contracts/
// https://docs.scroll.io/en/developers/ethereum-and-scroll-differences/
// https://status.scroll.io/

export type ScrollConfig = {
  ScrollChain: HexAddress;
  poseidon: HexAddress;
  apiURL: string;
};

export type ScrollCommit = RollupCommit<EthProver> & {
  readonly finalTxHash: HexString32;
};

// 20240815: commits are approximately every minute
// to make caching useful, we align to a step
// note: use 1 to disable the alignment
// 20240827: finalization is every ~15 min

export class ScrollRollup
  extends AbstractRollup<ScrollCommit>
  implements RollupWitnessV1<ScrollCommit>
{
  // https://docs.scroll.io/en/developers/scroll-contracts/
  // https://etherscan.io/address/0xC4362457a91B2E55934bDCb7DaaF6b1aB3dDf203
  static readonly mainnetConfig: RollupDeployment<ScrollConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SCROLL,
    ScrollChain: '0xa13BAF47339d63B743e7Da8741db5456DAc1E556',
    poseidon: '0x3508174Fa966e75f70B15348209E33BC711AE63e',
    apiURL: 'https://mainnet-api-re.scroll.io/api/', // https://scrollscan.com/batches
  };
  // https://sepolia.etherscan.io/address/0x64cb3A0Dcf43Ae0EE35C1C15edDF5F46D48Fa570
  static readonly testnetConfig: RollupDeployment<ScrollConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.SCROLL_SEPOLIA,
    ScrollChain: '0x2D567EcE699Eabe5afCd141eDB7A4f2D0D6ce8a0',
    poseidon: '0xFeE7242E8587d7E22Ea5E9cFC585d0eDB6D57faA',
    apiURL: 'https://sepolia-api-re.scroll.io/api/', // https://sepolia.scrollscan.com/batches
  };

  readonly apiURL: string;
  readonly ScrollChain: Contract;
  readonly poseidon: HexAddress;
  constructor(providers: ProviderPair, config: ScrollConfig) {
    super(providers);
    this.apiURL = config.apiURL;
    this.ScrollChain = new Contract(
      config.ScrollChain,
      ROLLUP_ABI,
      this.provider1
    );
    this.poseidon = config.poseidon;
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
    return this.ScrollChain.lastFinalizedBatchIndex({
      blockTag: l1BlockNumber - 1n,
    });
  }
  override async fetchLatestCommitIndex(): Promise<bigint> {
    // TODO: determine how to this w/o relying on indexer
    const [rpc, api]: bigint[] = await Promise.all([
      this.ScrollChain.lastFinalizedBatchIndex({
        blockTag: this.latestBlockTag,
      }),
      this.fetchAPILatestBatchIndex(),
    ]);
    return rpc > api ? api : rpc; // min(rpc, api)
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
    const prover = new EthProver(this.provider2, l2BlockNumber);
    return { index, prover, finalTxHash };
  }
  override encodeWitness(
    commit: ScrollCommit,
    proofSeq: ProofSequence
  ): HexString {
    return ABI_CODER.encode(
      ['tuple(uint256, bytes[], bytes)'],
      [[commit.index, proofSeq.proofs, proofSeq.order]]
    );
  }
  encodeWitnessV1(commit: ScrollCommit, proofSeq: ProofSequenceV1): HexString {
    const compressed = proofSeq.storageProofs.map((storageProof) =>
      concat([
        toPaddedHex(proofSeq.accountProof.length, 1),
        ...proofSeq.accountProof,
        toPaddedHex(storageProof.length, 1),
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
