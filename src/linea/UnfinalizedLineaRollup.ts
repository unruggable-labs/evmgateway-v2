import { type RollupCommit, AbstractRollup } from '../rollup.js';
import type {
  HexString,
  HexString32,
  ProofSequence,
  ProviderPair,
} from '../types.js';
import { keccak256 } from 'ethers/crypto';
import { Contract } from 'ethers/contract';
import { LineaProver } from './LineaProver.js';
import { ROLLUP_ABI } from './types.js';
import { ABI_CODER, fetchBlock, MAINNET_BLOCK_SEC } from '../utils.js';
import type { LineaConfig } from './LineaRollup.js';

export type UnfinalizedLineaCommit = RollupCommit<LineaProver> & {
  readonly abiEncodedTuple: HexString;
  readonly parentShnarf: HexString32;
};

export class UnfinalizedLineaRollup extends AbstractRollup<UnfinalizedLineaCommit> {
  readonly L1MessageService;
  constructor(
    providers: ProviderPair,
    config: LineaConfig,
    readonly minAgeBlocks: number
  ) {
    super(providers);
    this.L1MessageService = new Contract(
      config.L1MessageService,
      ROLLUP_ABI,
      this.provider1
    );
  }

  override async fetchLatestCommitIndex(): Promise<bigint> {
    const l1BlockInfo = await fetchBlock(this.provider1, this.latestBlockTag);
    const l1BlockNumber = parseInt(l1BlockInfo.number) - this.minAgeBlocks;
    const step = this.getLogsStepSize;
    for (let i = l1BlockNumber; i > 0n; i -= step) {
      const logs = await this.provider1.getLogs({
        address: this.L1MessageService.target,
        topics: [
          this.L1MessageService.filters.DataSubmittedV2.fragment.topicHash,
        ],
        fromBlock: i < step ? 0n : i + 1 - step,
        toBlock: i,
      });
      if (logs.length) return BigInt(logs[logs.length - 1].blockNumber);
      //return BigInt(logs[logs.length - 1].topics[3]); // end block
    }
    throw new Error(`no earlier shnarf: ${l1BlockNumber}`);
  }
  protected override async _fetchParentCommitIndex(
    commit: UnfinalizedLineaCommit
  ): Promise<bigint> {
    const [event] = await this.L1MessageService.queryFilter(
      this.L1MessageService.filters.DataSubmittedV2(commit.parentShnarf)
    );
    if (!event) throw new Error(`no earlier shnarf: ${commit.index}`);
    return BigInt(event.blockNumber);
    //return this.L1MessageService.shnarfFinalBlockNumbers(commit.parentShnarf);
  }
  protected override async _fetchCommit(
    index: bigint
  ): Promise<UnfinalizedLineaCommit> {
    const [event] = await this.L1MessageService.queryFilter(
      this.L1MessageService.filters.DataSubmittedV2(),
      index,
      index
    );
    if (!event) throw new Error(`no DataSubmittedV2`);
    const tx = await this.provider1.getTransaction(event.transactionHash);
    if (!tx || !tx.blockNumber || !tx.blobVersionedHashes) {
      throw new Error(`no submit tx: ${event.transactionHash}`);
    }
    const desc = this.L1MessageService.interface.parseTransaction(tx);
    if (!desc) throw new Error(`unable to parse tx`);
    type ABIBlobData = {
      submissionData: {
        finalStateRootHash: HexString32;
        firstBlockInData: bigint;
        finalBlockInData: bigint;
        snarkHash: HexString32;
      };
      dataEvaluationClaim: bigint;
      kzgCommitment: HexString;
      kzgProof: HexString;
    };
    const blobs = desc.args.blobSubmissionData as ABIBlobData[];
    if (!blobs.length) throw new Error('expected blobs');
    const parentShnarf = desc.args.parentShnarf as HexString32;
    let computedShnarf = parentShnarf;
    let abiEncodedTuple!: HexString;
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const currentDataEvaluationPoint = keccak256(
        ABI_CODER.encode(
          ['bytes32', 'bytes32'],
          [blob.submissionData.snarkHash, tx.blobVersionedHashes[i]]
        )
      );
      abiEncodedTuple = ABI_CODER.encode(
        ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
        [
          computedShnarf,
          blob.submissionData.snarkHash,
          blob.submissionData.finalStateRootHash,
          currentDataEvaluationPoint,
          blob.dataEvaluationClaim,
        ]
      );
      computedShnarf = keccak256(abiEncodedTuple);
    }
    if (computedShnarf !== desc.args.finalBlobShnarf) {
      throw new Error('shnarf mismatch');
    }
    return {
      index,
      prover: new LineaProver(
        this.provider2,
        blobs[blobs.length - 1].submissionData.finalBlockInData // l2BlockNumber
      ),
      abiEncodedTuple,
      parentShnarf,
    };
  }

  override encodeWitness(
    commit: UnfinalizedLineaCommit,
    proofSeq: ProofSequence
  ): HexString {
    return ABI_CODER.encode(
      ['(uint256, bytes, bytes[], bytes)'],
      [[commit.index, commit.abiEncodedTuple, proofSeq.proofs, proofSeq.order]]
    );
  }

  override windowFromSec(sec: number): number {
    return Math.ceil(sec / MAINNET_BLOCK_SEC); // units of L1Block
  }
}
