// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/interfaces/dispute/IAnchorStateRegistry.sol
interface IAnchorStateRegistry {
    function isGameProper(IDisputeGame) external view returns (bool);
    function respectedGameType() external view returns (uint256);
    function disputeGameFactory() external view returns (IDisputeGameFactory);
    //function portal() external view returns (IOptimismPortal);
}

// https://github.com/ethereum-optimism/optimism/blob/v1.13.7/packages/contracts-bedrock/src/L1/OptimismPortal2.sol
// interface IOptimismPortal {
// 	function anchorStateRegistry() external view returns (IAnchorStateRegistry);
//     function disputeGameFactory() external view returns (IDisputeGameFactory);
//     function disputeGameBlacklist(
//         IDisputeGame game
//     ) external view returns (bool);
//     function disputeGameFinalityDelaySeconds() external view returns (uint256);
//     function respectedGameTypeUpdatedAt() external view returns (uint64);
// }

// https://github.com/ethereum-optimism/optimism/blob/v1.13.7/packages/contracts-bedrock/interfaces/dispute/IDisputeGameFactory.sol
interface IDisputeGameFactory {
    function portal() external view returns (address);
    function gameCount() external view returns (uint256);
    function gameAtIndex(
        uint256 index
    )
        external
        view
        returns (uint256 gameType, uint256 created, IDisputeGame gameProxy);
}

// https://github.com/ethereum-optimism/optimism/blob/v1.18.1/packages/contracts-bedrock/interfaces/dispute/IDisputeGame.sol
// https://github.com/ethereum-optimism/optimism/blob/v1.13.7/packages/contracts-bedrock/interfaces/dispute/IDisputeGame.sol
interface IDisputeGame {
    function status() external view returns (uint256);
    function l2BlockNumber() external view returns (uint256); // old
    function l2SequenceNumber() external view returns (uint256); // new
    function rootClaim() external view returns (bytes32);
    function resolvedAt() external view returns (uint64);
    function wasRespectedGameTypeWhenCreated() external view returns (bool);
    function gameCreator() external view returns (address);
    function createdAt() external view returns (uint64);
    function gameType() external view returns (uint256);
}

struct OPFaultParams {
    IAnchorStateRegistry asr;
    uint256 minAgeSec;
    uint256[] allowedGameTypes;
    address[] allowedProposers;
}

interface IOPFaultGameFinder {
    function findGameIndex(
        OPFaultParams memory params,
        uint256 gameCount
    ) external view returns (uint256);
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
        );
}

// https://github.com/ethereum-optimism/optimism/blob/v1.13.7/packages/contracts-bedrock/interfaces/dispute/IFaultDisputeGame.sol
interface IFaultDisputeGame is IDisputeGame {
    function l2BlockNumberChallenged() external view returns (bool);
    // note: this is also on ISuperFaultDisputeGame
    function claimDataLen() external view returns (uint256);
}

// https://github.com/succinctlabs/op-succinct/blob/main/contracts/src/fp/OPSuccinctFaultDisputeGame.sol
interface IOPSuccinctFaultDisputeGame is IDisputeGame {
    enum ProposalStatus {
        // The initial state of a new proposal.
        Unchallenged,
        // A proposal that has been challenged but not yet proven.
        Challenged,
        // An unchallenged proposal that has been proven valid with a verified proof.
        UnchallengedAndValidProofProvided,
        // A challenged proposal that has been proven valid with a verified proof.
        ChallengedAndValidProofProvided,
        // The final state after resolution, either GameStatus.CHALLENGER_WINS or GameStatus.DEFENDER_WINS.
        Resolved
    }
    struct ClaimData {
        uint32 parentIndex;
        address counteredBy;
        address prover;
        bytes32 claim;
        ProposalStatus status;
        uint64 deadline;
    }
    function claimData() external view returns (ClaimData memory);
}

interface IAggregateVerifier {
    function parentAddress() external view returns (address);
}
