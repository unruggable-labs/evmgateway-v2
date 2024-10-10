// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './GatewayRequest.sol';
import {IVerifierHooks, InvalidProof, NOT_A_CONTRACT} from './IVerifierHooks.sol';
import {Bytes} from '../lib/optimism/packages/contracts-bedrock/src/libraries/Bytes.sol'; // Bytes.slice

import 'forge-std/console2.sol'; // DEBUG

struct ProofSequence {
    uint256 index;
    bytes32 stateRoot;
    bytes[] proofs;
    bytes order;
    IVerifierHooks hooks;
}

library GatewayVM {
    error RequestInvalid();

    // current limit is 256 because of stackBits
    uint256 constant MAX_STACK = 256;

    function dump(Machine memory vm, string memory label) internal view {
        console2.log('DEBUG(%s)', label);
        console2.log('[pos=%s/%s]', vm.pos, vm.buf.length);
        if (vm.buf.length < 256) console2.logBytes(vm.buf); // prevent spam
        console2.log('[target=%s slot=%s]', vm.target, vm.slot);
        console2.log('[proof=%s/%s]', vm.proofs.index, vm.proofs.order.length);
        console2.log('[stackSize=%s]', vm.stackSize);
        for (uint256 i; i < vm.stackSize; i++) {
            bytes memory v = vm.stackAsBytes(i);
            console2.log('%s [size=%s raw=%s]', i, v.length, vm.isStackRaw(i));
            console2.logBytes(v);
        }
        uint256 mem;
        assembly {
            mem := mload(64)
        }
        console2.log('[memory=%s gas=%s]', mem, gasleft());
    }

    // TODO: this checks beyond unaligned bound
    function isZeros(bytes memory v) internal pure returns (bool ret) {
        assembly {
            let p := add(v, 32)
            let e := add(p, mload(v))
            for {
                ret := 1
            } lt(p, e) {
                p := add(p, 32)
            } {
                if mload(p) {
                    ret := 0
                    break
                }
            }
        }
    }

    struct Machine {
        bytes buf;
        uint256 pos;
        uint256[] stack;
        uint256 stackSize;
        uint256 stackBits;
        address target;
        bytes32 storageRoot;
        uint256 slot;
        ProofSequence proofs;
    }

    using GatewayVM for Machine;

    function pushUint256(Machine memory vm, uint256 x) internal pure {
        vm.push(x, true);
    }
    function pushBytes(Machine memory vm, bytes memory v) internal pure {
        uint256 x;
        assembly {
            x := v // bytes => ptr
        }
        vm.push(x, false);
    }
    function push(Machine memory vm, uint256 x, bool raw) internal pure {
        uint256 i = vm.stackSize++;
        if (vm.isStackRaw(i) != raw) vm.stackBits ^= 1 << i;
        vm.stack[i] = x;
    }
    function isStackRaw(
        Machine memory vm,
        uint256 i
    ) internal pure returns (bool) {
        return (vm.stackBits & (1 << i)) != 0;
    }
    function isStackZeros(
        Machine memory vm,
        uint256 i
    ) internal pure returns (bool) {
        return
            vm.isStackRaw(i)
                ? vm.stackAsUint256(i) == 0
                : isZeros(vm.stackAsBytes(i));
    }
    function stackAsUint256(
        Machine memory vm,
        uint256 i
    ) internal pure returns (uint256 x) {
        x = vm.stack[i];
        if (!vm.isStackRaw(i)) {
            uint256 n;
            assembly {
                n := mload(x) // length
                x := mload(add(x, 32)) // first 32 bytes w/right pad
                if lt(n, 32) {
                    x := shr(shl(3, sub(32, n)), x) // remove right pad
                }
            }
        }
    }
    function stackAsBytes(
        Machine memory vm,
        uint256 i
    ) internal pure returns (bytes memory v) {
        uint256 x = vm.stack[i];
        if (vm.isStackRaw(i)) {
            v = abi.encode(x);
        } else {
            assembly {
                v := x // ptr => bytes
            }
        }
    }

    function popAsUint256(Machine memory vm) internal pure returns (uint256) {
        return vm.stackAsUint256(vm.pop());
    }
    function popAsBytes(
        Machine memory vm
    ) internal pure returns (bytes memory) {
        return vm.stackAsBytes(vm.pop());
    }
    function pop(Machine memory vm) internal pure returns (uint256) {
        return --vm.stackSize; // checked math
    }

    function checkBack(
        Machine memory vm,
        uint256 back
    ) internal pure returns (uint256) {
        //if (back < vm.stackSize) revert RequestInvalid();
        return vm.stackSize - 1 - back; // checked math
    }

    function checkRead(
        Machine memory vm,
        uint256 n
    ) internal pure returns (uint256 ptr) {
        uint256 pos = vm.pos;
        bytes memory buf = vm.buf;
        uint256 end = pos + n;
        if (end > buf.length) revert RequestInvalid();
        vm.pos = end;
        assembly {
            ptr := add(add(buf, 32), pos) // ptr of start in vm.buf
        }
    }
    function readByte(Machine memory vm) internal pure returns (uint8 i) {
        uint256 src = vm.checkRead(1);
        assembly {
            i := shr(248, mload(src)) // read one byte
        }
    }
    function readUint(
        Machine memory vm,
        uint256 n
    ) internal pure returns (uint256 x) {
        if (n == 0) return 0;
        if (n > 32) revert RequestInvalid();
        uint256 src = vm.checkRead(n);
        assembly {
            x := shr(shl(3, sub(32, n)), mload(src)) // remove right pad
        }
    }
    function readBytes(
        Machine memory vm,
        uint256 n
    ) internal pure returns (bytes memory v) {
        v = Bytes.slice(vm.buf, vm.pos, n); // throws on overflow
        vm.pos += n;
    }

    function readProof(Machine memory vm) internal pure returns (bytes memory) {
        ProofSequence memory p = vm.proofs;
        return p.proofs[uint8(p.order[p.index++])];
    }
    function getStorage(
        Machine memory vm,
        uint256 slot
    ) internal view returns (uint256) {
        bytes memory proof = vm.readProof();
        if (vm.storageRoot == NOT_A_CONTRACT) return 0;
        return
            uint256(
                vm.proofs.hooks.verifyStorageValue(
                    vm.storageRoot,
                    vm.target,
                    slot,
                    proof
                )
            );
    }
    function proveSlots(
        Machine memory vm,
        uint256 count
    ) internal view returns (bytes memory v) {
        v = new bytes(count << 5); // memory for count slots
        for (uint256 i; i < count; ) {
            uint256 value = vm.getStorage(vm.slot + i);
            assembly {
                i := add(i, 1)
                mstore(add(v, shl(5, i)), value) // append(value)
            }
        }
    }
    function proveBytes(
        Machine memory vm
    ) internal view returns (bytes memory v) {
        uint256 first = vm.getStorage(vm.slot);
        if ((first & 1) == 0) {
            // small
            v = new bytes((first & 0xFF) >> 1);
            assembly {
                mstore(add(v, 32), first) // set first 32 bytes
            }
        } else {
            // large
            uint256 size = first >> 1; // number of bytes
            first = (size + 31) >> 5; // number of slots
            v = new bytes(size);
            uint256 slot = uint256(keccak256(abi.encode(vm.slot))); // array start
            for (uint256 i; i < first; ) {
                uint256 value = vm.getStorage(slot + i);
                assembly {
                    i := add(i, 1)
                    mstore(add(v, shl(5, i)), value) // append(value)
                }
            }
        }
    }
    function proveArray(
        Machine memory vm,
        uint256 step
    ) internal view returns (bytes memory v) {
        uint256 first = vm.getStorage(vm.slot);
        uint256 count;
        if (step < 32) {
            uint256 per = 32 / step;
            count = (first + per - 1) / per;
        } else {
            count = first * ((step + 31) >> 5);
        }
        v = new bytes((1 + count) << 5); // +1 for length
        assembly {
            mstore(add(v, 32), first) // store length
        }
        uint256 slot = uint256(keccak256(abi.encode(vm.slot))); // array start
        for (uint256 i; i < count; ) {
            uint256 value = vm.getStorage(slot + i);
            assembly {
                i := add(i, 1)
                mstore(add(v, shl(5, add(i, 1))), value) // append(value)
            }
        }
    }

    function evalRequest(
        GatewayRequest memory req,
        ProofSequence memory proofs
    ) external view returns (bytes[] memory outputs, uint8 exitCode) {
        Machine memory vm;
        vm.pos = 0;
        vm.buf = req.ops;
        vm.stack = new uint256[](MAX_STACK);
        vm.stackBits = 0;
        vm.stackSize = 0;
        vm.proofs = proofs;
        vm.target = address(0);
        vm.storageRoot = NOT_A_CONTRACT;
        vm.slot = 0;
        outputs = new bytes[](vm.readByte()); // NOTE: implies maximum outputs is 255
        exitCode = evalCommand(vm, outputs);
    }

    function evalCommand(
        Machine memory vm,
        bytes[] memory outputs
    ) internal view returns (uint8 exitCode) {
        while (vm.pos < vm.buf.length) {
            //uint256 g = gasleft();
            uint8 op = vm.readByte();
            if (op <= OP_PUSH_32) {
                vm.pushUint256(vm.readUint(op));
            } else if (op == OP_PUSH_BYTES) {
                vm.pushBytes(vm.readBytes(vm.readUint(vm.readByte())));
            } else if (op == OP_TARGET) {
                vm.target = address(uint160(vm.popAsUint256()));
                vm.storageRoot = vm.proofs.hooks.verifyAccountState(
                    vm.proofs.stateRoot,
                    vm.target,
                    vm.readProof()
                );
                vm.slot = 0;
            } else if (op == OP_SET_OUTPUT) {
                uint256 i = vm.popAsUint256(); // rhs evaluates BEFORE lhs
                outputs[i] = vm.popAsBytes();
            } else if (op == OP_REQ_CONTRACT) {
                if (vm.storageRoot == NOT_A_CONTRACT)
                    return EXIT_NOT_A_CONTRACT;
            } else if (op == OP_REQ_NONZERO) {
                if (vm.isStackZeros(vm.checkBack(0))) return EXIT_NOT_NONZERO;
            } else if (op == OP_READ_SLOT) {
                vm.pushBytes(vm.proveSlots(1));
            } else if (op == OP_READ_SLOTS) {
                vm.pushBytes(vm.proveSlots(vm.popAsUint256()));
            } else if (op == OP_READ_BYTES) {
                vm.pushBytes(vm.proveBytes());
            } else if (op == OP_READ_HASHED_BYTES) {
                bytes memory v = vm.readProof();
                if (keccak256(v) != bytes32(vm.popAsUint256()))
                    revert InvalidProof();
                vm.pushBytes(v);
            } else if (op == OP_READ_ARRAY) {
                vm.pushBytes(vm.proveArray(vm.popAsUint256()));
            } else if (op == OP_SLOT) {
                vm.slot = vm.popAsUint256();
            } else if (op == OP_SLOT_ADD) {
                vm.slot += vm.popAsUint256();
            } else if (op == OP_SLOT_FOLLOW) {
                vm.slot = uint256(
                    keccak256(abi.encodePacked(vm.popAsBytes(), vm.slot))
                );
            } else if (op == OP_PUSH_STACK) {
                uint256 i = vm.popAsUint256();
                vm.push(vm.stack[i], vm.isStackRaw(i));
            } else if (op == OP_PUSH_OUTPUT) {
                vm.pushBytes(outputs[vm.popAsUint256()]);
            } else if (op == OP_PUSH_SLOT) {
                vm.pushUint256(vm.slot);
            } else if (op == OP_PUSH_TARGET) {
                vm.pushBytes(abi.encodePacked(vm.target)); // NOTE: 20 bytes
            } else if (op == OP_PUSH_STACK_SIZE) {
                vm.pushUint256(vm.stackSize);
            } else if (op == OP_DUP) {
                uint256 i = vm.checkBack(vm.popAsUint256());
                vm.push(vm.stack[i], vm.isStackRaw(i));
            } else if (op == OP_POP) {
                if (vm.stackSize != 0) --vm.stackSize;
            } else if (op == OP_SWAP) {
                uint256 i = vm.checkBack(vm.popAsUint256());
                uint256 j = vm.checkBack(0);
                (vm.stack[i], vm.stack[j]) = (vm.stack[j], vm.stack[i]);
                if (vm.isStackRaw(i) != vm.isStackRaw(j)) {
                    vm.stackBits ^= (1 << i) | (1 << j);
                }
            } else if (op == OP_SLICE) {
                uint256 size = vm.popAsUint256();
                uint256 pos = vm.popAsUint256();
                bytes memory v = vm.popAsBytes();
                uint256 end = pos + size;
                if (end <= v.length) {
                    vm.pushBytes(Bytes.slice(v, pos, size));
                } else if (pos >= v.length) {
                    vm.pushBytes(new bytes(size)); // beyond end
                } else {
                    vm.pushBytes(
                        bytes.concat(
                            Bytes.slice(v, pos, v.length - pos), // partial
                            new bytes(end - v.length)
                        )
                    );
                }
            } else if (op == OP_KECCAK) {
                uint256 i = vm.pop();
                if (vm.isStackRaw(i)) {
                    uint256 temp = vm.stackAsUint256(i);
                    assembly {
                        mstore(0, temp)
                        temp := keccak256(0, 32) // efficient keccak
                    }
                    vm.pushUint256(temp);
                } else {
                    vm.pushUint256(uint256(keccak256(vm.stackAsBytes(i))));
                }
            } else if (op == OP_LENGTH) {
                uint256 i = vm.pop();
                vm.pushUint256(
                    vm.isStackRaw(i) ? 32 : vm.stackAsBytes(i).length
                );
            } else if (op == OP_CONCAT) {
                bytes memory last = vm.popAsBytes();
                vm.pushBytes(bytes.concat(vm.popAsBytes(), last));
            } else if (op == OP_PLUS) {
                uint256 last = vm.popAsUint256();
                unchecked {
                    vm.pushUint256(vm.popAsUint256() + last);
                }
            } else if (op == OP_TIMES) {
                uint256 last = vm.popAsUint256();
                unchecked {
                    vm.pushUint256(vm.popAsUint256() * last);
                }
            } else if (op == OP_DIVIDE) {
                uint256 last = vm.popAsUint256();
                unchecked {
                    vm.pushUint256(vm.popAsUint256() / last);
                }
            } else if (op == OP_MOD) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() % last);
            } else if (op == OP_AND) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() & last);
            } else if (op == OP_OR) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() | last);
            } else if (op == OP_XOR) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() ^ last);
            } else if (op == OP_SHIFT_LEFT) {
                vm.pushUint256(vm.popAsUint256() << vm.popAsUint256());
            } else if (op == OP_SHIFT_RIGHT) {
                vm.pushUint256(vm.popAsUint256() >> vm.popAsUint256());
            } else if (op == OP_EQ) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() == last ? 1 : 0);
            } else if (op == OP_LT) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() < last ? 1 : 0);
            } else if (op == OP_GT) {
                uint256 last = vm.popAsUint256();
                vm.pushUint256(vm.popAsUint256() > last ? 1 : 0);
            } else if (op == OP_NOT) {
                vm.pushUint256(~vm.popAsUint256());
            } else if (op == OP_IS_ZERO) {
                vm.pushUint256(vm.isStackZeros(vm.pop()) ? 1 : 0);
            } else if (op == OP_EVAL_INLINE) {
                bytes memory program = vm.popAsBytes();
                uint256 pos = vm.pos;
                bytes memory buf = vm.buf;
                vm.buf = program;
                vm.pos = 0;
                exitCode = evalCommand(vm, outputs);
                if (exitCode != 0) return exitCode;
                vm.pos = pos;
                vm.buf = buf;
            } else if (op == OP_EVAL_LOOP) {
                uint8 flags = vm.readByte();
                uint256 count = vm.popAsUint256();
                Machine memory vm2;
                vm2.buf = vm.popAsBytes();
                vm2.proofs = vm.proofs;
                vm2.stack = new uint256[](MAX_STACK);
                if (count > vm.stackSize) count = vm.stackSize;
                while (count > 0) {
                    --count;
                    vm2.target = vm.target;
                    vm2.storageRoot = vm.storageRoot;
                    vm2.slot = vm.slot;
                    vm2.pos = 0;
                    vm2.stackSize = 0;
                    uint256 i = vm.pop();
                    vm2.push(vm.stack[i], vm.isStackRaw(i));
                    if (
                        (flags &
                            (
                                vm2.evalCommand(outputs) != 0
                                    ? STOP_ON_FAILURE
                                    : STOP_ON_SUCCESS
                            )) != 0
                    ) {
                        if ((flags & KEEP_ARGS) == 0) {
                            vm.stackSize -= count;
                        }
                        if ((flags & ACQUIRE_STATE) != 0) {
                            vm.target = vm2.target;
                            vm.storageRoot = vm2.storageRoot;
                            vm.slot = vm2.slot;
                            for (i = 0; i < vm2.stackSize; i += 1) {
                                vm.push(vm2.stack[i], vm2.isStackRaw(i));
                            }
                        }
                        break;
                    }
                }
            } else if (op == OP_DEBUG) {
                vm.dump(string(vm.readBytes(vm.readByte())));
            } else {
                revert RequestInvalid();
            }
            //console2.log("op=%s gas=%s", op, g - gasleft());
        }
        return 0;
    }
}
