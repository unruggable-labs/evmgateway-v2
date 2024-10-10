import {
  type RollupCommit,
  type RollupDeployment,
  type RollupWitnessV1,
  AbstractRollup,
} from '../rollup.js';
import type {
  HexAddress,
  HexString,
  ProviderPair,
  ProofSequence,
  ProofSequenceV1,
} from '../types.js';
import type { RPCEthGetBlock } from '../eth/types.js';
import { type ABINodeTuple, ROLLUP_ABI } from './types.js';
import { ZeroHash } from 'ethers/constants';
import { Contract, EventLog } from 'ethers/contract';
import { CHAINS } from '../chains.js';
import { EthProver } from '../eth/EthProver.js';
import { ABI_CODER, fetchBlock, MAINNET_BLOCK_SEC } from '../utils.js';
import { encodeRlpBlock } from '../rlp.js';

// https://docs.arbitrum.io/how-arbitrum-works/inside-arbitrum-nitro#the-rollup-chain

export type NitroConfig = {
  L2Rollup: HexAddress;
  minAgeBlocks?: number;
};

export type NitroCommit = RollupCommit<EthProver> & {
  readonly sendRoot: HexString;
  readonly rlpEncodedBlock: HexString;
  readonly prevNum: bigint;
};

export class NitroRollup
  extends AbstractRollup<NitroCommit>
  implements RollupWitnessV1<NitroCommit>
{
  // https://docs.arbitrum.io/build-decentralized-apps/reference/useful-addresses
  static readonly arb1MainnetConfig: RollupDeployment<NitroConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.ARB1,
    L2Rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
  };
  static readonly arbTestnetConfig: RollupDeployment<NitroConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.ARB_SEPOLIA,
    L2Rollup: '0xd80810638dbDF9081b72C1B33c65375e807281C8',
  };
  static readonly arbNovaMainnetConfig: RollupDeployment<NitroConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.ARB_NOVA,
    L2Rollup: '0xFb209827c58283535b744575e11953DCC4bEAD88',
  };

  readonly L2Rollup;
  readonly minAgeBlocks;
  constructor(providers: ProviderPair, config: NitroConfig) {
    super(providers);
    this.L2Rollup = new Contract(config.L2Rollup, ROLLUP_ABI, this.provider1);
    this.minAgeBlocks = config.minAgeBlocks ?? 0;
  }

  async fetchLatestNode(minAgeBlocks = 0) {
    if (minAgeBlocks) {
      const blockInfo = await fetchBlock(this.provider1, this.latestBlockTag);
      const blockTag = BigInt(blockInfo.number) - BigInt(minAgeBlocks);
      return this.L2Rollup.latestNodeCreated({
        blockTag,
      });
    } else {
      return this.L2Rollup.latestConfirmed({
        blockTag: this.latestBlockTag,
      });
    }
  }

  override fetchLatestCommitIndex(): Promise<bigint> {
    return this.fetchLatestNode(this.minAgeBlocks);
  }
  protected override async _fetchParentCommitIndex(
    commit: NitroCommit
  ): Promise<bigint> {
    return this.minAgeBlocks ? commit.index - 1n : commit.prevNum;
  }
  protected override async _fetchCommit(index: bigint): Promise<NitroCommit> {
    const { createdAtBlock, prevNum }: ABINodeTuple =
      await this.L2Rollup.getNode(index);
    if (!createdAtBlock) throw new Error('unknown node');
    const [event] = await this.L2Rollup.queryFilter(
      this.L2Rollup.filters.NodeCreated(index),
      createdAtBlock,
      createdAtBlock
    );
    if (!(event instanceof EventLog)) throw new Error('no NodeCreated event');
    // ethers bug: named abi parsing doesn't propagate through event tuples
    // [4][1][0][0] == event.args.afterState.globalState.bytes32Vals[0];
    const [blockHash, sendRoot] = event.args[4][1][0][0];
    const block: RPCEthGetBlock | null = await this.provider2.send(
      'eth_getBlockByHash',
      [blockHash, false]
    );
    if (!block) throw new Error(`no block: ${blockHash}`);
    // note: block.sendRoot == sendRoot
    const rlpEncodedBlock = encodeRlpBlock(block);
    const prover = new EthProver(this.provider2, block.number);
    return { index, prover, sendRoot, rlpEncodedBlock, prevNum };
  }
  override encodeWitness(
    commit: NitroCommit,
    proofSeq: ProofSequence
  ): HexString {
    return ABI_CODER.encode(
      ['tuple(uint256, bytes32, bytes, bytes[], bytes)'],
      [
        [
          commit.index,
          commit.sendRoot,
          commit.rlpEncodedBlock,
          proofSeq.proofs,
          proofSeq.order,
        ],
      ]
    );
  }
  encodeWitnessV1(commit: NitroCommit, proofSeq: ProofSequenceV1): HexString {
    return ABI_CODER.encode(
      [
        'tuple(bytes32 version, bytes32 sendRoot, uint64 nodeIndex, bytes rlpEncodedBlock)',
        'tuple(bytes, bytes[])',
      ],
      [
        [ZeroHash, commit.sendRoot, commit.index, commit.rlpEncodedBlock],
        [proofSeq.accountProof, proofSeq.storageProofs],
      ]
    );
  }

  override windowFromSec(sec: number): number {
    // finalization time is not on-chain
    // the delta between createdAtBlock is a sufficient proxy
    return Math.ceil(sec / MAINNET_BLOCK_SEC); // units of L1 blocks
  }
}
