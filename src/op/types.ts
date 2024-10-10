import { Interface } from 'ethers/abi';
import type { HexString32 } from '../types.js';

export const ORACLE_ABI = new Interface([
  `function latestOutputIndex() external view returns (uint256)`,
  `function getL2Output(uint256 outputIndex) external view returns (
     tuple(bytes32 outputRoot, uint128 timestamp, uint128 l2BlockNumber)
   )`,
]);

export type ABIOutputTuple = {
  outputRoot: HexString32;
  timestamp: bigint;
  l2BlockNumber: bigint;
};

export const PORTAL_ABI = new Interface([
  `function disputeGameFactory() view returns (address)`,
  `function respectedGameType() view returns (uint32)`,
]);

export const GAME_FINDER_ABI = new Interface([
  `function findGameIndex(address portal, uint256 minAge, uint256 gameTypeBitMask, uint256 gameCount) external view returns (uint256)`,
  `function gameAtIndex(address portal, uint256 minAge, uint256 gameTypeBitMask, uint256 gameIndex) external view returns (
     uint256 gameType, uint256 created, address gameProxy, uint256 l2BlockNumber
   )`,
]);

export const L1_BLOCK_ABI = new Interface([
  `function number() view returns (uint256)`,
  //`function hash() view returns (bytes32)`,
]);
