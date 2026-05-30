// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {
    IDisputeGameFactory,
    IDisputeGame,
    OPFaultParams,
    IFaultDisputeGame,
    IOPSuccinctFaultDisputeGame,
    IAggregateVerifier
} from './OPInterfaces.sol';

// https://github.com/ethereum-optimism/optimism/issues/11269

// https://github.com/ethereum-optimism/optimism/blob/v1.18.1/packages/contracts-bedrock/src/dispute/lib/Types.sol
uint256 constant GAME_STATUS_IN_PROGRESS = 0;
uint256 constant GAME_STATUS_CHALLENGER_WINS = 1;
uint256 constant GAME_STATUS_DEFENDER_WINS = 2;

uint256 constant GAME_TYPE_AGGREGATE_VERIFIER = 621;
uint256 constant GAME_TYPE_SUCCINCT = 42;

error GameNotFound();

struct FinderState {
    uint256 respectedGameType; // get once and save
    uint256 succinctGameIndex; // avoids O(n^2) _isUnchallenged() for IOPSuccinctFaultDisputeGame
}

contract OPFaultGameFinder {
    function findGameIndex(
        OPFaultParams memory params,
        uint256 gameBound
    ) external view virtual returns (uint256) {
        IDisputeGameFactory dgf = params.asr.disputeGameFactory();
        if (gameBound == 0) gameBound = dgf.gameCount();
        FinderState memory state = FinderState({
            respectedGameType: params.asr.respectedGameType(),
            succinctGameIndex: gameBound
        });
        while (gameBound > 0) {
            (uint256 gameType, uint256 created, IDisputeGame gameProxy) = dgf
                .gameAtIndex(--gameBound);
            if (_isGameUsable(gameProxy, gameType, created, params, state)) {
                return gameBound;
            }
        }
        revert GameNotFound();
    }

    function gameAtIndex(
        OPFaultParams memory params,
        uint256 gameIndex
    )
        external
        view
        returns (
            uint256 gameType,
            uint256 created,
            IDisputeGame gameProxy,
            uint256 l2BlockNumber,
            bytes32 rootClaim
        )
    {
        IDisputeGameFactory dgf = params.asr.disputeGameFactory();
        (gameType, created, gameProxy) = dgf.gameAtIndex(gameIndex);
        if (
            _isGameUsable(
                gameProxy,
                gameType,
                created,
                params,
                FinderState({
                    respectedGameType: params.asr.respectedGameType(),
                    succinctGameIndex: gameIndex
                })
            )
        ) {
            try gameProxy.l2SequenceNumber() returns (uint256 blockNumber) {
                l2BlockNumber = blockNumber;
            } catch {
                l2BlockNumber = gameProxy.l2BlockNumber();
            }
            rootClaim = gameProxy.rootClaim();
        }
    }

    function _isGameUsable(
        IDisputeGame gameProxy,
        uint256 gameType,
        uint256 created,
        OPFaultParams memory params,
        FinderState memory state
    ) internal view returns (bool) {
        // if allowed gameTypes is empty, accept a respected game OR a previously respected game
        if (
            !(
                params.allowedGameTypes.length == 0
                    ? (gameType == state.respectedGameType ||
                        gameProxy.wasRespectedGameTypeWhenCreated())
                    : _isAllowedGameType(gameType, params.allowedGameTypes)
            )
        ) {
            return false;
        }
        // if no proposer restrictions or proposer is whitelisted
        if (
            !_isAllowedProposer(
                gameProxy.gameCreator(),
                params.allowedProposers
            )
        ) return false;
        // https://specs.optimism.io/fault-proof/stage-one/bridge-integration.html#blacklisting-disputegames
        // https://specs.optimism.io/fault-proof/stage-one/anchor-state-registry.html#proper-game
        if (!params.asr.isGameProper(gameProxy)) return false;
        if (params.minAgeSec > 0) {
            if (created > block.timestamp - params.minAgeSec) return false;
            if (_isUnchallenged(gameProxy, gameType, params, state))
                return true;
        }
        return gameProxy.status() == GAME_STATUS_DEFENDER_WINS; // require resolved
    }

    function _isAllowedGameType(
        uint256 gameType,
        uint256[] memory allowedGameTypes
    ) internal pure returns (bool) {
        for (uint256 i; i < allowedGameTypes.length; ++i) {
            if (allowedGameTypes[i] == gameType) return true;
        }
        return false;
    }

    function _isAllowedProposer(
        address proposer,
        address[] memory allowedProposers
    ) internal pure returns (bool) {
        for (uint256 i; i < allowedProposers.length; ++i) {
            if (allowedProposers[i] == proposer) return true;
        }
        return allowedProposers.length == 0;
    }

    /// @dev Attempt to determine if the game is challenged in any sense.
    function _isUnchallenged(
        IDisputeGame gameProxy,
        uint256 gameType,
        OPFaultParams memory params,
        FinderState memory state
    ) internal view returns (bool) {
        if (gameType == GAME_TYPE_AGGREGATE_VERIFIER) {
            for (;;) {
                uint256 status = gameProxy.status();
                if (status == GAME_STATUS_DEFENDER_WINS) {
                    return true;
                } else if (status == GAME_STATUS_CHALLENGER_WINS) {
                    return false;
                }
                address parent = IAggregateVerifier(address(gameProxy))
                    .parentAddress();
                if (parent == address(0)) {
                    return false;
                } else if (parent == address(params.asr)) {
                    return true;
                }
                gameProxy = IDisputeGame(parent);
            }
        } else if (gameType == GAME_TYPE_SUCCINCT) {
            try
                IOPSuccinctFaultDisputeGame(address(gameProxy)).claimData()
            returns (IOPSuccinctFaultDisputeGame.ClaimData memory data) {
                if (_isUnchallengedStatus(data.status)) {
                    IDisputeGameFactory dgf = params.asr.disputeGameFactory();
                    uint256 gameIndex = data.parentIndex;
                    uint256 gameType0 = gameProxy.gameType();
                    while (true) {
                        if (gameIndex == type(uint32).max) return true; // anchor state is resolved
                        if (gameIndex >= state.succinctGameIndex) return false; // already checked
                        (
                            uint256 gameType1,
                            uint256 created,
                            IDisputeGame parentGame
                        ) = dgf.gameAtIndex(gameIndex);
                        if (gameType1 != gameType0) {
                            // this is a different game type
                            return
                                _isGameUsable(
                                    parentGame,
                                    gameType1,
                                    created,
                                    params,
                                    state
                                );
                        }
                        data = IOPSuccinctFaultDisputeGame(address(parentGame))
                            .claimData();
                        if (_isUnchallengedStatus(data.status)) {
                            gameIndex = data.parentIndex; // keep checking ancestry
                        } else {
                            state.succinctGameIndex = gameIndex; // remember
                            return
                                data.status ==
                                IOPSuccinctFaultDisputeGame
                                    .ProposalStatus
                                    .Resolved &&
                                parentGame.status() ==
                                GAME_STATUS_DEFENDER_WINS;
                        }
                    }
                }
            } catch {}
        }
        try
            IFaultDisputeGame(address(gameProxy)).l2BlockNumberChallenged()
        returns (bool challenged) {
            // this challenge is independent of the game resolution
            if (challenged) return false;
        } catch {}
        // if supportsInterface(IFaultDisputeGame)
        try IFaultDisputeGame(address(gameProxy)).claimDataLen() returns (
            uint256 claims
        ) {
            if (claims == 1) return true;
        } catch {}
        // unknown type
        // assume challenged and require resolved
        return false;
    }

    function _isUnchallengedStatus(
        IOPSuccinctFaultDisputeGame.ProposalStatus status
    ) internal pure returns (bool) {
        return
            status == IOPSuccinctFaultDisputeGame.ProposalStatus.Unchallenged ||
            status ==
            IOPSuccinctFaultDisputeGame
                .ProposalStatus
                .UnchallengedAndValidProofProvided;
    }
}
