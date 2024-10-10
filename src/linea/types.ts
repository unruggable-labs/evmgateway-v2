import type { HexString, HexString32 } from '../types.js';
import { Interface } from 'ethers/abi';
import { ABI_CODER, NULL_CODE_HASH } from '../utils.js';
import { dataSlice } from 'ethers/utils';

export const ROLLUP_ABI = new Interface([
  // ZkEvmV2.sol
  `function currentL2BlockNumber() view returns (uint256)`,
  `function stateRootHashes(uint256 l2BlockNumber) view returns (bytes32)`,
  `function shnarfFinalBlockNumbers(bytes32 shnarf) external view returns (uint256)`,
  // ILineaRollup.sol
  `event DataFinalized(
    uint256 indexed lastBlockFinalized,
    bytes32 indexed startingRootHash,
    bytes32 indexed finalRootHash,
    bool withProof
  )`,
  `event DataSubmittedV2(
    bytes32 indexed shnarf,
    uint256 indexed startBlock,
    uint256 indexed endBlock
  )`,
  `function submitBlobs(
    (
      (
	    bytes32 finalStateRootHash,
        uint256 firstBlockInData,
        uint256 finalBlockInData,
        bytes32 snarkHash
      ) submissionData,
      uint256 dataEvaluationClaim,
      bytes kzgCommitment,
      bytes kzgProof
    )[] blobSubmissionData,
    bytes32 parentShnarf,
    bytes32 finalBlobShnarf
  ) external`,
  // IZkEvmV2.sol
  `event BlocksVerificationDone(uint256 indexed lastBlockFinalized, bytes32 startingRootHash, bytes32 finalRootHash)`,
]);

export type LineaProofObject = {
  proofRelatedNodes: HexString[];
  value: HexString;
};

export type LineaExclusionProof = {
  key: HexString32;
  leftLeafIndex: number;
  leftProof: LineaProofObject;
  rightLeafIndex: number;
  rightProof: LineaProofObject;
};

export type LineaInclusionProof = {
  key: HexString32;
  leafIndex: number;
  proof: LineaProofObject;
};

export type LineaProof = LineaExclusionProof | LineaInclusionProof;

export type RPCLineaGetProof = {
  accountProof: LineaProof;
  storageProofs: LineaProof[]; // note: this is plural
};

export function isInclusionProof(proof: LineaProof) {
  return 'leafIndex' in proof;
}

//const NULL_CODE_HASH = '0x0134373b65f439c874734ff51ea349327c140cde2e47a933146e6f9f2ad8eb17'; // mimc(ZeroHash)

export function isContract(accountProof: LineaProof) {
  return (
    isInclusionProof(accountProof) &&
    // https://github.com/Consensys/linea-monorepo/blob/a001342170768a22988a29b2dca8601199c6e205/contracts/contracts/lib/SparseMerkleProof.sol#L23
    dataSlice(accountProof.proof.value, 128, 160) !== NULL_CODE_HASH
  );
}

export function encodeProof(proof: LineaProof) {
  const T = 'tuple(uint256, bytes, bytes[])';
  return ABI_CODER.encode(
    [T, T],
    isInclusionProof(proof)
      ? [
          [proof.leafIndex, proof.proof.value, proof.proof.proofRelatedNodes],
          [0, '0x', []],
        ]
      : [
          [
            proof.leftLeafIndex,
            proof.leftProof.value,
            proof.leftProof.proofRelatedNodes,
          ],
          [
            proof.rightLeafIndex,
            proof.rightProof.value,
            proof.rightProof.proofRelatedNodes,
          ],
        ]
  );
}
