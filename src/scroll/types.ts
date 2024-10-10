import { Interface } from 'ethers/abi';

// https://github.com/scroll-tech/scroll/tree/738c85759d0248c005469972a49fc983b031ff1c/contracts/src/L1

// export const VERIFIER_ABI = new Interface([
//   `function rollup() view returns (address)`,
//   `function poseidon() view returns (address)`,
// ]);

export const ROLLUP_ABI = new Interface([
  `function lastFinalizedBatchIndex() view returns (uint256)`,
  `function finalizedStateRoots(uint256 batchIndex) view returns (bytes32)`,
  `event FinalizeBatch(
    uint256 indexed batchIndex,
    bytes32 indexed batchHash,
    bytes32 stateRoot,
    bytes32 withdrawRoot
  )`,
]);

// export const POSEIDON_ABI = new Interface([
//   'function poseidon(uint256[2], uint256) external view returns (bytes32)',
// ]);
