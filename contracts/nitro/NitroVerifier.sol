// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractVerifier} from '../AbstractVerifier.sol';
import {IVerifierHooks} from '../IVerifierHooks.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {RLPReader, RLPReaderExt} from '../RLPReaderExt.sol';
import {IRollupCore, Node} from './IRollupCore.sol';

contract NitroVerifier is AbstractVerifier {
    IRollupCore immutable _rollup;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks,
        IRollupCore rollup
    ) AbstractVerifier(urls, window, hooks) {
        _rollup = rollup;
    }

    function getLatestContext() external view returns (bytes memory) {
        return abi.encode(_rollup.latestConfirmed());
    }

    struct GatewayProof {
        uint64 nodeNum;
        bytes32 sendRoot;
        bytes rlpEncodedBlock;
        bytes[] proofs;
        bytes order;
    }

    function getStorageValues(
        bytes memory context,
        GatewayRequest memory req,
        bytes memory proof
    ) external view returns (bytes[] memory, uint8 exitCode) {
        uint64 nodeNum1 = abi.decode(context, (uint64));
        GatewayProof memory p = abi.decode(proof, (GatewayProof));
        Node memory node = _rollup.getNode(p.nodeNum);
        if (p.nodeNum != nodeNum1) {
			// it wasn't what we requested
            Node memory node1 = _rollup.getNode(nodeNum1);
			// check if node is between latest and our window
            _checkWindow(node1.createdAtBlock, node.createdAtBlock);
			// check if node is member of confirmed chain
            while (node1.prevNum > p.nodeNum) {
                node1 = _rollup.getNode(node1.prevNum);
            }
            require(node1.prevNum == p.nodeNum, 'Nitro: not confirmed');
        }
        bytes32 confirmData = keccak256(
            abi.encodePacked(keccak256(p.rlpEncodedBlock), p.sendRoot)
        );
        require(confirmData == node.confirmData, 'Nitro: confirmData');
        RLPReader.RLPItem[] memory v = RLPReader.readList(p.rlpEncodedBlock);
        bytes32 stateRoot = RLPReaderExt.strictBytes32FromRLP(v[3]); // see: rlp.ts: encodeRlpBlock()
        return
            GatewayVM.evalRequest(
                req,
                ProofSequence(0, stateRoot, p.proofs, p.order, _hooks)
            );
    }
}
