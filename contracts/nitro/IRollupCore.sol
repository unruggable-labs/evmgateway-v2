// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// extracted from:
// https://github.com/OffchainLabs/nitro-contracts/blob/v2.1.0/src/rollup/IRollupCore.sol
// https://github.com/OffchainLabs/nitro-contracts/blob/v2.1.0/src/rollup/Node.sol

struct Node {
    bytes32 stateHash;
    bytes32 challengeHash;
    bytes32 confirmData;
    uint64 prevNum;
    uint64 deadlineBlock;
    uint64 noChildConfirmedBeforeBlock;
    uint64 stakerCount;
    uint64 childStakerCount;
    uint64 firstChildBlock;
    uint64 latestChildNumber;
    uint64 createdAtBlock;
    bytes32 nodeHash;
}

interface IRollupCore {
    function latestConfirmed() external view returns (uint64);
    function latestNodeCreated() external view returns (uint64);
    function getNode(uint64 nodeNum) external view returns (Node memory);
}
