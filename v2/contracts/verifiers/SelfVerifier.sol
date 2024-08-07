// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EVMRequest, EVMProver, ProofSequence} from "../EVMProver.sol";
import {MerkleTrieHelper} from "../MerkleTrieHelper.sol";
import {ScrollTrieHelper, IPoseidon} from "../ScrollTrieHelper.sol";

contract SelfVerifier {

	IPoseidon immutable _poseidon;
	constructor(IPoseidon poseidon) {
		_poseidon = poseidon;
	}

	function verifyMerkle(EVMRequest memory req, bytes32 stateRoot, bytes[][] memory proofs, bytes memory order) external view returns (bytes[] memory outputs, uint8 exitCode) {
		return EVMProver.evalRequest(req, ProofSequence(0, stateRoot, proofs, order, MerkleTrieHelper.proveAccountState, MerkleTrieHelper.proveStorageValue));
	}

	function verifyScroll(EVMRequest memory req, bytes32 stateRoot, bytes[][] memory proofs, bytes memory order) external view returns (bytes[] memory outputs, uint8 exitCode) {
		return EVMProver.evalRequest(req, ProofSequence(0, stateRoot, proofs, order, verifyScroll_proveAccountState, verifyScroll_proveStorageValue));
	}
	function verifyScroll_proveAccountState(bytes32 stateRoot, address target, bytes[] memory proof) internal view returns (bytes32) {
		return ScrollTrieHelper.proveAccountState(_poseidon, stateRoot, target, proof);
	}
	function verifyScroll_proveStorageValue(bytes32 storageRoot, uint256 slot, bytes[] memory proof) internal view returns (uint256) {
		return uint256(ScrollTrieHelper.proveStorageValue(_poseidon, storageRoot, slot, proof));
	}

}
