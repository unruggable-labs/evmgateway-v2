// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AbstractVerifier, IVerifierHooks} from '../AbstractVerifier.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {Hashing, Types} from '../../lib/optimism/packages/contracts-bedrock/src/libraries/Hashing.sol';
import '../../lib/optimism/packages/contracts-bedrock/src/dispute/interfaces/IDisputeGameFactory.sol';

interface IOptimismPortal {
    function disputeGameFactory() external view returns (IDisputeGameFactory);
    function respectedGameType() external view returns (GameType);
    // we don't care if the root was blacklisted, this only applies to withdrawals
    //function disputeGameBlacklist(IDisputeGame game) external view returns (bool);
}

interface IOPFaultGameFinder {
    function findGameIndex(
        IOptimismPortal portal,
        uint256 minAgeSec,
        uint256 gameTypeBitMask,
        uint256 gameCount
    ) external view returns (uint256);
    function gameAtIndex(
        IOptimismPortal portal,
        uint256 minAgeSec,
        uint256 gameTypeBitMask,
        uint256 gameIndex
    )
        external
        view
        returns (
            uint256 gameType,
            uint256 created,
            IDisputeGame gameProxy,
            uint256 l2BlockNumber
        );
}

struct OPFaultParams {
    IOptimismPortal portal;
    IOPFaultGameFinder gameFinder;
    uint256 gameTypeBitMask;
    uint256 minAgeSec;
}

contract OPFaultVerifier is AbstractVerifier {
    IOptimismPortal immutable _portal;
    IOPFaultGameFinder immutable _gameFinder;
    uint256 immutable _gameTypeBitMask;
    uint256 immutable _minAgeSec;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks,
        OPFaultParams memory params
    ) AbstractVerifier(urls, window, hooks) {
        _portal = params.portal;
        _gameFinder = params.gameFinder;
        _gameTypeBitMask = params.gameTypeBitMask;
        _minAgeSec = params.minAgeSec;
    }

    function getLatestContext() external view virtual returns (bytes memory) {
        return
            abi.encode(
                _gameFinder.findGameIndex(
                    _portal,
                    _minAgeSec,
                    _gameTypeBitMask,
                    0
                )
            );
    }

    struct GatewayProof {
        uint256 gameIndex;
        Types.OutputRootProof outputRootProof;
        bytes[] proofs;
        bytes order;
    }

    function getStorageValues(
        bytes memory context,
        GatewayRequest memory req,
        bytes memory proof
    ) external view returns (bytes[] memory, uint8 exitCode) {
        uint256 gameIndex1 = abi.decode(context, (uint256));
        GatewayProof memory p = abi.decode(proof, (GatewayProof));
        (, , IDisputeGame gameProxy, uint256 blockNumber) = _gameFinder
            .gameAtIndex(_portal, _minAgeSec, _gameTypeBitMask, p.gameIndex);
        require(blockNumber != 0, 'OPFault: invalid game');
        if (p.gameIndex != gameIndex1) {
            (, , IDisputeGame gameProxy1) = _portal
                .disputeGameFactory()
                .gameAtIndex(gameIndex1);
            _checkWindow(
                Timestamp.unwrap(gameProxy1.resolvedAt()),
                Timestamp.unwrap(gameProxy.resolvedAt())
            );
        }
        require(
            Claim.unwrap(gameProxy.rootClaim()) ==
                Hashing.hashOutputRootProof(p.outputRootProof),
            'OPFault: rootClaim'
        );
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
