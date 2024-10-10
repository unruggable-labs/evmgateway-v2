// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractVerifier} from '../AbstractVerifier.sol';
import {IVerifierHooks} from '../IVerifierHooks.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {RLPReader, RLPReaderExt} from '../RLPReaderExt.sol';
import {Node, IRollupCore} from './IRollupCore.sol';

contract UnfinalizedNitroVerifier is AbstractVerifier {
    IRollupCore immutable _rollup;
    uint256 immutable _minBlocks;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks,
        IRollupCore rollup,
        uint256 minBlocks
    ) AbstractVerifier(urls, window, hooks) {
        _rollup = rollup;
        _minBlocks = minBlocks;
    }

    function getLatestContext() external view returns (bytes memory) {
        uint64 i = _rollup.latestNodeCreated();
        uint256 b = block.number - _minBlocks;
        while (true) {
            Node memory node = _rollup.getNode(i);
            if (node.createdAtBlock <= b) {
                return abi.encode(i);
            }
            if (i == 0) break;
            --i;
        }
        revert('UnfinalizedNitro: no node');
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
            Node memory node1 = _rollup.getNode(nodeNum1);
            _checkWindow(node1.createdAtBlock, node.createdAtBlock);
        }
        bytes32 confirmData = keccak256(
            abi.encodePacked(keccak256(p.rlpEncodedBlock), p.sendRoot)
        );
        require(confirmData == node.confirmData, 'UnfinalizedNitro: confirmData');
        RLPReader.RLPItem[] memory v = RLPReader.readList(p.rlpEncodedBlock);
        bytes32 stateRoot = RLPReaderExt.strictBytes32FromRLP(v[3]); // see: rlp.ts: encodeRlpBlock()
        return
            GatewayVM.evalRequest(
                req,
                ProofSequence(0, stateRoot, p.proofs, p.order, _hooks)
            );
    }
}
