// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractVerifier, IVerifierHooks} from '../AbstractVerifier.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {ILineaRollup} from './ILineaRollup.sol';

//import 'forge-std/console2.sol';

contract UnfinalizedLineaVerifier is AbstractVerifier {
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
        return abi.encode(block.number - 1);
    }

    struct GatewayProof {
        uint256 l1BlockNumber;
        bytes abiEncodedTuple;
        bytes[] proofs;
        bytes order;
    }

    function getStorageValues(
        bytes memory /*context*/,
        GatewayRequest memory req,
        bytes memory proof
    ) external view returns (bytes[] memory, uint8 exitCode) {
        //uint256 l1BlockNumber1 = abi.decode(context, (uint256));
        GatewayProof memory p = abi.decode(proof, (GatewayProof));
        // TODO: must prove a time constraint on the shnarf
        // ideas:
        // 1.) prove l1BlockNumber contains the transaction that that commit this shnarf
        // 2.) prove some L1 state on L2 using l2BlockNumber and stateRoot
        // 3.) use some heuristic based on L2.lastAnchoredL1MessageNumber and L1.nextMessageNumber?
        //_checkWindow(p.l1BlockNumber, l1BlockNumber1);
        bytes32 stateRoot = _extractStateRoot(p.abiEncodedTuple);
        uint256 l2BlockNumber = _rollup.shnarfFinalBlockNumbers(
            keccak256(p.abiEncodedTuple)
        );
        // this is the only guard available
        // the shnarf must be newer than the finalization
        if (l2BlockNumber < _rollup.currentL2BlockNumber()) {
            // TODO: remove this once we have a time constraint
            // if it's older than the finalization, it must match
            require(
                stateRoot == _rollup.stateRootHashes(l2BlockNumber),
                'UnfinalizedLinea: not finalized'
            );
        }
        return
            GatewayVM.evalRequest(
                req,
                ProofSequence(0, stateRoot, p.proofs, p.order, _hooks)
            );
    }

    function _extractStateRoot(
        bytes memory v
    ) internal pure returns (bytes32 stateRoot) {
        assembly {
            stateRoot := mload(add(v, 96)) // see: ShnarfData
        }
    }
}
