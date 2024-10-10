// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractVerifier, IVerifierHooks} from '../AbstractVerifier.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {ILineaRollup} from './ILineaRollup.sol';

contract LineaVerifier is AbstractVerifier {
    ILineaRollup immutable _rollup;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks,
        ILineaRollup rollup
    ) AbstractVerifier(urls, window, hooks) {
        _rollup = rollup;
    }

    function getLatestContext() external view returns (bytes memory) {
        return abi.encode(_rollup.currentL2BlockNumber());
    }

    struct GatewayProof {
        uint256 l2BlockNumber;
        bytes[] proofs;
        bytes order;
    }

    function getStorageValues(
        bytes memory context,
        GatewayRequest memory req,
        bytes memory proof
    ) external view returns (bytes[] memory, uint8 exitCode) {
        uint256 l2BlockNumber1 = abi.decode(context, (uint256));
        GatewayProof memory p = abi.decode(proof, (GatewayProof));
        _checkWindow(l2BlockNumber1, p.l2BlockNumber);
        bytes32 stateRoot = _rollup.stateRootHashes(p.l2BlockNumber);
        if (stateRoot == bytes32(0)) revert('Linea: not finalized');
        return
            GatewayVM.evalRequest(
                req,
                ProofSequence(0, stateRoot, p.proofs, p.order, _hooks)
            );
    }
}
