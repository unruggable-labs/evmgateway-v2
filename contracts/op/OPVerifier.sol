// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AbstractVerifier, IVerifierHooks} from '../AbstractVerifier.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {Hashing, Types} from '../../lib/optimism/packages/contracts-bedrock/src/libraries/Hashing.sol';

interface IL2OutputOracle {
    function latestOutputIndex() external view returns (uint256);
    function getL2Output(
        uint256 outputIndex
    ) external view returns (Types.OutputProposal memory);
}

contract OPVerifier is AbstractVerifier {
    IL2OutputOracle immutable _oracle;
    uint256 immutable _minAgeSec;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks,
        IL2OutputOracle oracle,
        uint256 minAgeSec
    ) AbstractVerifier(urls, window, hooks) {
        _oracle = oracle;
        _minAgeSec = minAgeSec;
    }

    function getLatestContext() external view returns (bytes memory) {
        uint256 i = _oracle.latestOutputIndex();
        uint256 t = block.timestamp - _minAgeSec;
        while (true) {
            Types.OutputProposal memory output = _oracle.getL2Output(i);
            if (output.timestamp <= t) {
                return abi.encode(i);
            }
            if (i == 0) break;
            --i;
        }
		revert('OP: no output');
    }

    struct GatewayProof {
        uint256 outputIndex;
        Types.OutputRootProof outputRootProof;
        bytes[] proofs;
        bytes order;
    }

    function getStorageValues(
        bytes memory context,
        GatewayRequest memory req,
        bytes memory proof
    ) external view returns (bytes[] memory, uint8 exitCode) {
        uint256 outputIndex1 = abi.decode(context, (uint256));
        GatewayProof memory p = abi.decode(proof, (GatewayProof));
        Types.OutputProposal memory output = _oracle.getL2Output(p.outputIndex);
        if (p.outputIndex != outputIndex1) {
            Types.OutputProposal memory output1 = _oracle.getL2Output(
                outputIndex1
            );
            _checkWindow(output1.timestamp, output.timestamp);
        }
        bytes32 computedRoot = Hashing.hashOutputRootProof(p.outputRootProof);
        require(computedRoot == output.outputRoot, 'OP: invalid root');
        return
            GatewayVM.evalRequest(
                req,
                ProofSequence(
                    0,
                    p.outputRootProof.stateRoot,
                    p.proofs,
                    p.order,
                    _hooks
                )
            );
    }
}
