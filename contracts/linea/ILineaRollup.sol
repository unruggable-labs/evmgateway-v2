// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// https://github.com/Consensys/linea-contracts/blob/main/contracts/interfaces/l1/ILineaRollup.sol
// https://github.com/Consensys/linea-contracts/blob/main/contracts/LineaRollup.sol
// https://github.com/Consensys/linea-contracts/blob/main/contracts/ZkEvmV2.sol

interface ILineaRollup {
    function currentL2BlockNumber() external view returns (uint256);
    function stateRootHashes(
        uint256 l2BlockNumber
    ) external view returns (bytes32);
    function shnarfFinalBlockNumbers(
        bytes32 shnarf
    ) external view returns (uint256);
}
