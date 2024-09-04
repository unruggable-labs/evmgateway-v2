// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {DataFetchTarget, IDataProofVerifier} from "@unruggable/gateways/contracts/DataFetchTarget.sol";
import {DataFetcher, DataRequest} from "@unruggable/gateways/contracts/DataFetcher.sol";

contract SlotDataReader is DataFetchTarget {
	using DataFetcher for DataRequest;
	IDataProofVerifier immutable _verifier;
	address immutable _target;
	constructor(IDataProofVerifier verifier, address target) {
		_verifier = verifier;
		_target = target;
	}
	function debugCallback(bytes[] memory m, uint8 exitCode, bytes memory) external pure returns (bytes[] memory, uint8) {
		return (m, exitCode);
	}
	function uint256Callback(bytes[] memory m, uint8, bytes memory) external pure returns (uint256) {
		return abi.decode(m[0], (uint256));
	}
	function stringCallback(bytes[] memory m, uint8, bytes memory) external pure returns (string memory) {
		return string(m[0]);
	}

	function test() external returns (string memory) {

		return "test2";
	}

	function readLatest() external  returns (uint256) {
		//return 123;
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(0).read().setOutput(0);
		fetch(_verifier, r, this.uint256Callback.selector, '');
	}
/*
	function readName() external view returns (string memory) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(1).readBytes().setOutput(0);
		fetch(_verifier, r, this.stringCallback.selector, '');
	}

	function readHighscore(uint256 key) external view returns (uint256) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(2).push(key).follow().read().setOutput(0);
		fetch(_verifier, r, this.uint256Callback.selector, '');
	}

	function readLatestHighscore() external view returns (uint256) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(0).read().setSlot(2).follow().read().setOutput(0);
		fetch(_verifier, r, this.uint256Callback.selector, '');
	}

	function readLatestHighscorer() external view returns (string memory) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(0).read().setSlot(3).follow().readBytes().setOutput(0);
		fetch(_verifier, r, this.stringCallback.selector, '');
	}

	function readRealName(string memory key) external view returns (string memory) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(4).push(key).follow().readBytes().setOutput(0);
		fetch(_verifier, r, this.stringCallback.selector, '');
	}

	function readLatestHighscorerRealName() external view returns (string memory) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(0).read().setSlot(3).follow().readBytes().setSlot(4).follow().readBytes().setOutput(0);
		fetch(_verifier, r, this.stringCallback.selector, '');
	}

	function readZero() external view returns (uint256) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(5).read().setOutput(0);
		fetch(_verifier, r, this.uint256Callback.selector, '');
	}

	function readRootStr(string[] memory keys) external view returns (string memory) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(12);
		for (uint256 i; i < keys.length; i++) {
			r.offset(2).push(keys[i]).follow();
		}
		r.offset(1).readBytes().setOutput(0);
		fetch(_verifier, r, this.stringCallback.selector, '');
	}

	function readSlicedKeccak() external view returns (string memory) {
		DataRequest memory r = DataFetcher.newRequest(1).setTarget(_target);
		r.setSlot(0).read().setSlot(3).follow().readBytes().setSlot(4).follow().readBytes().slice(0, 3); // "Hal"
		r.setSlot(0).read().setSlot(2).follow().read().slice(16, 16); // uint128(12345)
		r.concat().keccak().setSlot(3).follow().readBytes().setOutput(0); // highscorers[keccak("Hal"+12345)]
		fetch(_verifier, r, this.stringCallback.selector, '');
	}
*/
}
