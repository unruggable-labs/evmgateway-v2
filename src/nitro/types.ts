import { Interface } from 'ethers/abi';

// https://github.com/OffchainLabs/nitro-contracts/blob/main/src/rollup/RollupCore.sol
export const ROLLUP_ABI = new Interface([
  `function latestConfirmed() view returns (uint64)`,
  `function latestNodeCreated() view returns (uint64)`,
  `function getNode(uint64 nodeNum) view returns (tuple(
    bytes32 stateHash,
    bytes32 challengeHash,
    bytes32 confirmData,
    uint64 prevNum,
    uint64 deadlineBlock,
    uint64 noChildConfirmedBeforeBlock,
    uint64 stakerCount,
    uint64 childStakerCount,
    uint64 firstChildBlock,
    uint64 latestChildNumber,
    uint64 createdAtBlock,
    bytes32 nodeHash
  ))`,
  //'function latestNodeCreated() external view returns (uint64)',
  `event NodeCreated(
    uint64 indexed nodeNum,
    bytes32 indexed parentNodeHash,
    bytes32 indexed nodeHash,
    bytes32 executionHash,
    tuple(
      tuple(tuple(bytes32[2] bytes32Vals, uint64[2] u64Vals) globalState, uint8 machineStatus) beforeState,
      tuple(tuple(bytes32[2] bytes32Vals, uint64[2] u64Vals) globalState, uint8 machineStatus) afterState,
      uint64 numBlocks
    ) assertion,
    bytes32 afterInboxBatchAcc,
    bytes32 wasmModuleRoot,
    uint256 inboxMaxCount
  )`,
]);

export type ABINodeTuple = {
  readonly prevNum: bigint;
  readonly createdAtBlock: bigint;
};
