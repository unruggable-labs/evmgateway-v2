// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './GatewayRequest.sol';

// only happens during request construction
error RequestOverflow();

library GatewayFetcher {
    // verifier execution is only constrainted by stack and gas
    // max outputs = 255
    // NOTE: this is developer configurable
    uint256 constant MAX_OPS = 8192;

    using GatewayFetcher for GatewayRequest;

    function newRequest(
        uint8 outputs
    ) internal pure returns (GatewayRequest memory) {
        return newCommand().addByte(outputs);
    }

    function newCommand() internal pure returns (GatewayRequest memory) {
        bytes memory v = new bytes(MAX_OPS);
        assembly {
            mstore(v, 0) // length = 0
        }
        return GatewayRequest(v);
    }

    function encode(
        GatewayRequest memory r
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(r.ops);
    }

    function addByte(
        GatewayRequest memory r,
        uint8 i
    ) internal pure returns (GatewayRequest memory) {
        bytes memory v = r.ops;
        uint256 n = v.length;
        if (n >= MAX_OPS) revert RequestOverflow();
        assembly {
            mstore(v, add(n, 1)) // length += 1
            mstore8(add(add(v, 32), n), i) // append(i)
        }
        return r;
    }
    function addBytes(
        GatewayRequest memory r,
        bytes memory v
    ) internal pure returns (GatewayRequest memory) {
        bytes memory buf = r.ops;
        if (r.ops.length + v.length >= MAX_OPS) revert RequestOverflow();
        assembly {
            let dst := add(add(buf, 32), mload(buf)) // ptr to write
            let src := add(v, 32) // ptr to start read
            for {
                let src_end := add(src, mload(v)) // ptr to stop read
            } lt(src, src_end) {
                src := add(src, 32)
                dst := add(dst, 32)
            } {
                mstore(dst, mload(src)) // copy word
            }
            mstore(buf, add(mload(buf), mload(v))) // length += v.length
        }
        return r;
    }

    function debug(
        GatewayRequest memory r,
        string memory label
    ) internal pure returns (GatewayRequest memory) {
        bytes memory v = bytes(label);
        return r.addByte(OP_DEBUG).push(v.length).addBytes(v);
    }

    function push(
        GatewayRequest memory r,
        bytes32 x
    ) internal pure returns (GatewayRequest memory) {
        return r.push(uint256(x));
    }
    function push(
        GatewayRequest memory r,
        address x
    ) internal pure returns (GatewayRequest memory) {
        return r.push(uint160(x));
    }
    function push(
        GatewayRequest memory r,
        uint256 x
    ) internal pure returns (GatewayRequest memory) {
        // NOTE: compact request building is not necessary
        // this could just be: return r.addByte(OP_PUSH_32).addBytes(abi.encode(x));
        if (x == 0) return r.addByte(OP_PUSH_0);
        uint8 n = clz(x); // number of leading zeros
        x <<= (n << 3); // right pad
        n = 32 - n; // width w/o pad
        r.addByte(OP_PUSH_0 + n);
        bytes memory v = r.ops;
        assembly {
            let len := mload(v)
            mstore(add(add(v, 32), len), x) // append(x)
            mstore(v, add(len, n)) // length += n
        }
        return r;
    }
    function clz(uint256 x) private pure returns (uint8 n) {
        if (x < (1 << 128)) {
            x <<= 128;
            n |= 16;
        }
        if (x < (1 << 192)) {
            x <<= 64;
            n |= 8;
        }
        if (x < (1 << 224)) {
            x <<= 32;
            n |= 4;
        }
        if (x < (1 << 240)) {
            x <<= 16;
            n |= 2;
        }
        if (x < (1 << 248)) {
            n |= 1;
        }
    }

    function push(
        GatewayRequest memory r,
        string memory s
    ) internal pure returns (GatewayRequest memory) {
        return r.push(bytes(s));
    }
    function push(
        GatewayRequest memory r,
        GatewayRequest memory p
    ) internal pure returns (GatewayRequest memory) {
        return r.push(p.encode());
    }
    function push(
        GatewayRequest memory r,
        bytes memory v
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_PUSH_BYTES).push(v.length).addBytes(v);
    }

    function pushSlot(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_PUSH_SLOT);
    }
    function pushTarget(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_PUSH_TARGET);
    }
    function pushStackSize(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_PUSH_STACK_SIZE);
    }

    // pushBytes() => push()
    // pushProgram() => push()
    function pushStack(
        GatewayRequest memory r,
        uint256 i
    ) internal pure returns (GatewayRequest memory) {
        return r.push(i).addByte(OP_PUSH_STACK);
        // r.pushStackSize().push(1).subtract().push(i).subtract().addByte(OP_DUP);
    }
    function pushOutput(
        GatewayRequest memory r,
        uint256 i
    ) internal pure returns (GatewayRequest memory) {
        return r.push(i).addByte(OP_PUSH_OUTPUT);
    }

    function target(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_TARGET);
    }
    function setTarget(
        GatewayRequest memory r,
        address a
    ) internal pure returns (GatewayRequest memory) {
        return r.push(a).target();
    }

    function setOutput(
        GatewayRequest memory r,
        uint8 i
    ) internal pure returns (GatewayRequest memory) {
        return r.push(i).output();
    }
    function output(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_SET_OUTPUT);
    }
    function eval(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_EVAL_INLINE);
    }
    function evalLoop(
        GatewayRequest memory r,
        uint8 flags
    ) internal pure returns (GatewayRequest memory) {
        return r.evalLoop(flags, 255);
    }
    function evalLoop(
        GatewayRequest memory r,
        uint8 flags,
        uint256 count
    ) internal pure returns (GatewayRequest memory) {
        return r.push(count).addByte(OP_EVAL_LOOP).addByte(flags);
    }

    function setSlot(
        GatewayRequest memory r,
        uint256 x
    ) internal pure returns (GatewayRequest memory) {
        return r.push(x).slot();
    }
    function offset(
        GatewayRequest memory r,
        uint256 dx
    ) internal pure returns (GatewayRequest memory) {
        return r.push(dx).addSlot();
    }
    function addSlot(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_SLOT_ADD);
        // return r.pushSlot().add().slot();
    }
    function slot(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_SLOT);
    }
    function follow(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_SLOT_FOLLOW);
        // return r.pushSlot().concat().keccak().slot();
    }
    function followIndex(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.pushSlot().keccak().slot().addSlot();
    }

    function requireContract(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_REQ_CONTRACT);
    }
    function requireNonzero(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_REQ_NONZERO);
    }

    function read(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_READ_SLOT);
    }
    function read(
        GatewayRequest memory r,
        uint256 n
    ) internal pure returns (GatewayRequest memory) {
        return r.push(n).addByte(OP_READ_SLOTS);
    }
    function readBytes(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_READ_BYTES);
    }
    function readHashedBytes(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_READ_HASHED_BYTES);
    }
    function readArray(
        GatewayRequest memory r,
        uint256 step
    ) internal pure returns (GatewayRequest memory) {
        return r.push(step).addByte(OP_READ_ARRAY);
    }

    function pop(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_POP);
    }
    function dup(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.dup(0);
    }
    function dup(
        GatewayRequest memory r,
        uint256 back
    ) internal pure returns (GatewayRequest memory) {
        return r.push(back).addByte(OP_DUP);
    }
    function swap(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.swap(1);
    }
    function swap(
        GatewayRequest memory r,
        uint256 back
    ) internal pure returns (GatewayRequest memory) {
        return r.push(back).addByte(OP_SWAP);
    }

    function concat(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_CONCAT);
    }
    function keccak(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_KECCAK);
    }
    function slice(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_SLICE);
    }
    function slice(
        GatewayRequest memory r,
        uint256 pos,
        uint256 len
    ) internal pure returns (GatewayRequest memory) {
        return r.push(pos).push(len).slice();
    }
    function length(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_LENGTH);
    }

    function plus(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_PLUS);
    }
    function twosComplement(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.not().push(1).plus();
    }
    function subtract(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.twosComplement().plus();
    }
    function times(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_TIMES);
    }
    function divide(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_DIVIDE);
    }
    function mod(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_MOD);
    }
    function and(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_AND);
    }
    function or(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_OR);
    }
    function xor(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_XOR);
    }
    function isZero(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_IS_ZERO);
    }
    function not(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_NOT);
    }
    function shl(
        GatewayRequest memory r,
        uint8 shift
    ) internal pure returns (GatewayRequest memory) {
        return r.push(shift).addByte(OP_SHIFT_LEFT);
    }
    function shr(
        GatewayRequest memory r,
        uint8 shift
    ) internal pure returns (GatewayRequest memory) {
        return r.push(shift).addByte(OP_SHIFT_RIGHT);
    }
    function eq(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_EQ);
    }
    function lt(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_LT);
    }
    function gt(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.addByte(OP_GT);
    }
    function neq(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.eq().isZero();
    }
    function lte(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.gt().isZero();
    }
    function gte(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.lt().isZero();
    }
    function dup2(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.dup(1).dup(1);
    }
    function min(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.dup2().gt().addByte(OP_SWAP).pop();
    }
    function max(
        GatewayRequest memory r
    ) internal pure returns (GatewayRequest memory) {
        return r.dup2().lt().addByte(OP_SWAP).pop();
    }
}
