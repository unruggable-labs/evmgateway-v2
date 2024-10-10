// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {RLPReader, ContentLengthMismatch} from '../lib/optimism/packages/contracts-bedrock/src/libraries/rlp/RLPReader.sol';

library RLPReaderExt {
    function bytes32FromRLP(
        RLPReader.RLPItem memory item
    ) internal pure returns (bytes32) {
        return bytes32FromRLP(RLPReader.readBytes(item));
    }

    function bytes32FromRLP(bytes memory v) internal pure returns (bytes32) {
        if (v.length > 32) revert ContentLengthMismatch();
        return bytes32(v) >> ((32 - v.length) << 3);
    }

    function strictBytes32FromRLP(
        RLPReader.RLPItem memory item
    ) internal pure returns (bytes32) {
        bytes memory v = RLPReader.readBytes(item);
        if (v.length != 32) revert ContentLengthMismatch();
        return bytes32(v);
    }

    // same as: keccak256(RLPReader.readRawBytes(item))
    // but does not allocate
    function keccak256FromRawRLP(
        RLPReader.RLPItem memory item
    ) internal pure returns (bytes32 ret) {
        assembly {
            ret := keccak256(mload(add(item, 32)), mload(item))
        }
    }
}
