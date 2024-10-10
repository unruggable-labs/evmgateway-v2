// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AbstractVerifier, IVerifierHooks} from '../AbstractVerifier.sol';
import {GatewayRequest, GatewayVM, ProofSequence} from '../GatewayVM.sol';
import {RLPReader, RLPReaderExt} from '../RLPReaderExt.sol';

// https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts-bedrock/src/L2/L1Block.sol
interface IL1Block {
    function number() external view returns (uint256);
}

contract ReverseOPVerifier is AbstractVerifier {
    uint256 immutable SLOT_HASH = 2;
    IL1Block immutable _l1Block;

    constructor(
        string[] memory urls,
        uint256 window,
        IVerifierHooks hooks,
        IL1Block l1Block
    ) AbstractVerifier(urls, window, hooks) {
        _l1Block = l1Block;
    }

    function getLatestContext() external view returns (bytes memory) {
        return abi.encode(_l1Block.number());
    }

    struct GatewayProof {
        bytes rlpEncodedL1Block;
        bytes rlpEncodedL2Block;
        bytes accountProof;
        bytes storageProof;
        bytes[] proofs;
        bytes order;
    }

    function getStorageValues(
        bytes memory context,
        GatewayRequest memory req,
        bytes memory proof
    ) external view returns (bytes[] memory, uint8 exitCode) {
        uint256 blockNumber1 = abi.decode(context, (uint256));
        GatewayProof memory p = abi.decode(proof, (GatewayProof));
        RLPReader.RLPItem[] memory v = RLPReader.readList(p.rlpEncodedL2Block);
        bytes32 blockHash = blockhash(_extractBlockNumber(v));
        require(
            blockHash == keccak256(p.rlpEncodedL2Block),
            'ReverseOP: hash2'
        );
        bytes32 stateRoot = RLPReaderExt.strictBytes32FromRLP(v[3]);
        bytes32 storageRoot = _hooks.verifyAccountState(
            stateRoot,
            address(_l1Block),
            p.accountProof
        );
        blockHash = _hooks.verifyStorageValue(
            storageRoot,
            address(_l1Block),
            SLOT_HASH,
            p.storageProof
        );
        require(
            blockHash == keccak256(p.rlpEncodedL1Block),
            'ReverseOP: hash1'
        );
        v = RLPReader.readList(p.rlpEncodedL1Block);
        _checkWindow(blockNumber1, _extractBlockNumber(v));
        stateRoot = RLPReaderExt.strictBytes32FromRLP(v[3]);
        return
            GatewayVM.evalRequest(
                req,
                ProofSequence(0, stateRoot, p.proofs, p.order, _hooks)
            );
    }

    function _extractBlockNumber(
        RLPReader.RLPItem[] memory v
    ) internal pure returns (uint256) {
        return uint256(RLPReaderExt.bytes32FromRLP(v[8]));
    }
}
