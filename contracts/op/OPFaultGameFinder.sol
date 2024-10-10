// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// https://github.com/ethereum-optimism/optimism/issues/11269

// https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/L1/OptimismPortal.sol
interface IOptimismPortal {
    function disputeGameFactory() external view returns (IDisputeGameFactory);
    function respectedGameType() external view returns (uint256);
}

// https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/interfaces/IDisputeGameFactory.sol
interface IDisputeGameFactory {
    function gameCount() external view returns (uint256);
    function gameAtIndex(
        uint256 index
    )
        external
        view
        returns (uint256 gameType, uint256 created, IDisputeGame gameProxy);
}

// https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/interfaces/IDisputeGame.sol
interface IDisputeGame {
    function status() external view returns (uint256);
    function l2BlockNumber() external view returns (uint256);
}

// https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/dispute/lib/Types.sol#L7
uint256 constant CHALLENGER_WINS = 1;
uint256 constant DEFENDER_WINS = 2;

contract OPFaultGameFinder {
    error GameNotFound();

    function findGameIndex(
        IOptimismPortal portal,
        uint256 minAgeSec,
        uint256 gameTypeBitMask,
        uint256 gameCount
    ) external view virtual returns (uint256) {
        if (gameTypeBitMask == 0)
            gameTypeBitMask = 1 << portal.respectedGameType();
        IDisputeGameFactory factory = portal.disputeGameFactory();
        if (gameCount == 0) gameCount = factory.gameCount();
        while (gameCount > 0) {
            (
                uint256 gameType,
                uint256 created,
                IDisputeGame gameProxy
            ) = factory.gameAtIndex(--gameCount);
            if (
                _isGameUsable(
                    gameProxy,
                    gameType,
                    created,
                    gameTypeBitMask,
                    minAgeSec
                )
            ) {
                return gameCount;
            }
        }
        revert GameNotFound();
    }

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
        )
    {
        if (gameTypeBitMask == 0)
            gameTypeBitMask = 1 << portal.respectedGameType();
        IDisputeGameFactory factory = portal.disputeGameFactory();
        (gameType, created, gameProxy) = factory.gameAtIndex(gameIndex);
        if (
            _isGameUsable(
                gameProxy,
                gameType,
                created,
                gameTypeBitMask,
                minAgeSec
            )
        ) {
            l2BlockNumber = gameProxy.l2BlockNumber();
        }
    }

    function _isGameUsable(
        IDisputeGame gameProxy,
        uint256 gameType,
        uint256 created,
        uint256 gameTypeBitMask,
        uint256 minAgeSec
    ) internal view returns (bool) {
        if (gameTypeBitMask & (1 << gameType) == 0) return false;
        if (minAgeSec == 0) {
            return gameProxy.status() == DEFENDER_WINS;
        } else {
            return
                created <= block.timestamp - minAgeSec &&
                gameProxy.status() != CHALLENGER_WINS;
        }
    }
}
