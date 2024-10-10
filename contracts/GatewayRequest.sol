// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct GatewayRequest {
    bytes ops;
}

// eval flags
uint8 constant STOP_ON_SUCCESS = 1 << 0;
uint8 constant STOP_ON_FAILURE = 1 << 1;
uint8 constant ACQUIRE_STATE = 1 << 2;
uint8 constant KEEP_ARGS = 1 << 3;

// exit codes
uint8 constant EXIT_NOT_A_CONTRACT = 254;
uint8 constant EXIT_NOT_NONZERO = 253;

// ops
uint8 constant OP_PUSH_0 = 0;
uint8 constant OP_PUSH_1 = 1;
uint8 constant OP_PUSH_2 = 2;
uint8 constant OP_PUSH_3 = 3;
uint8 constant OP_PUSH_4 = 4;
uint8 constant OP_PUSH_5 = 5;
uint8 constant OP_PUSH_6 = 6;
uint8 constant OP_PUSH_7 = 7;
uint8 constant OP_PUSH_8 = 8;
uint8 constant OP_PUSH_9 = 9;
uint8 constant OP_PUSH_10 = 10;
uint8 constant OP_PUSH_11 = 11;
uint8 constant OP_PUSH_12 = 12;
uint8 constant OP_PUSH_13 = 13;
uint8 constant OP_PUSH_14 = 14;
uint8 constant OP_PUSH_15 = 15;
uint8 constant OP_PUSH_16 = 16;
uint8 constant OP_PUSH_17 = 17;
uint8 constant OP_PUSH_18 = 18;
uint8 constant OP_PUSH_19 = 19;
uint8 constant OP_PUSH_20 = 20;
uint8 constant OP_PUSH_21 = 21;
uint8 constant OP_PUSH_22 = 22;
uint8 constant OP_PUSH_23 = 23;
uint8 constant OP_PUSH_24 = 24;
uint8 constant OP_PUSH_25 = 25;
uint8 constant OP_PUSH_26 = 26;
uint8 constant OP_PUSH_27 = 27;
uint8 constant OP_PUSH_28 = 28;
uint8 constant OP_PUSH_29 = 29;
uint8 constant OP_PUSH_30 = 30;
uint8 constant OP_PUSH_31 = 31;
uint8 constant OP_PUSH_32 = 32;

uint8 constant OP_PUSH_SLOT = 33;
uint8 constant OP_PUSH_TARGET = 34;
uint8 constant OP_PUSH_STACK_SIZE = 35;

uint8 constant OP_PUSH_BYTES = 40;
uint8 constant OP_PUSH_STACK = 41;
uint8 constant OP_PUSH_OUTPUT = 42;

uint8 constant OP_TARGET = 50;
uint8 constant OP_SET_OUTPUT = 51;
uint8 constant OP_EVAL_LOOP = 52;
uint8 constant OP_EVAL_INLINE = 53;
uint8 constant OP_REQ_NONZERO = 54;
uint8 constant OP_REQ_CONTRACT = 55;

uint8 constant OP_READ_SLOT = 60;
uint8 constant OP_READ_BYTES = 61;
uint8 constant OP_READ_ARRAY = 62;
uint8 constant OP_READ_HASHED_BYTES = 63;
uint8 constant OP_READ_SLOTS = 64;

uint8 constant OP_SLOT = 70;
uint8 constant OP_SLOT_ADD = 71;
uint8 constant OP_SLOT_FOLLOW = 72;

uint8 constant OP_DUP = 80;
uint8 constant OP_POP = 81;
uint8 constant OP_SWAP = 82;

uint8 constant OP_KECCAK = 90;
uint8 constant OP_CONCAT = 91;
uint8 constant OP_SLICE = 92;
uint8 constant OP_LENGTH = 93;

uint8 constant OP_PLUS = 100;
uint8 constant OP_TIMES = 101;
uint8 constant OP_DIVIDE = 102;
uint8 constant OP_MOD = 103;

uint8 constant OP_AND = 110;
uint8 constant OP_OR = 111;
uint8 constant OP_XOR = 112;
uint8 constant OP_SHIFT_LEFT = 113;
uint8 constant OP_SHIFT_RIGHT = 114;
uint8 constant OP_NOT = 115;

uint8 constant OP_IS_ZERO = 120;
uint8 constant OP_EQ = 121;
uint8 constant OP_LT = 122;
uint8 constant OP_GT = 123;

uint8 constant OP_DEBUG = 255;
