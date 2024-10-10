// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {OPFaultGameFinder, IOptimismPortal} from "../../contracts/op/OPFaultGameFinder.sol";

contract FixedOPFaultGameFinder is OPFaultGameFinder {

	uint256 immutable _gameIndex;

	constructor(uint256 gameIndex) {
		_gameIndex = gameIndex;
	}

	function findGameIndex(IOptimismPortal, uint256, uint256, uint256) external override view returns (uint256) {
		return _gameIndex;
	}

}