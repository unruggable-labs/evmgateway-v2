import type { BytesLike } from './types.js';
import { getBytes, hexlify, toUtf8String } from 'ethers/utils';
import { GatewayProgram, GatewayRequest } from './vm.js';
import { GATEWAY_OP as OP } from './ops.js';

const NAMES: string[] = [];
Object.entries(OP).forEach(([name, op]) => (NAMES[op] = name));

type ProgramAction = {
  pos: number;
  op: number;
  name: string;
} & Record<string, any>;

export class ProgramReader {
  static actions(program: GatewayProgram) {
    const reader = this.fromProgram(program);
    const actions: ProgramAction[] = [];
    if (program instanceof GatewayRequest) {
      actions.push({
        pos: 0,
        op: reader.readByte(), // outputCount,
        name: 'OUTPUT_COUNT',
      });
    }
    while (reader.remaining) {
      actions.push(reader.readAction());
    }
    return actions;
  }
  static fromProgram(program: GatewayProgram) {
    return new this(Uint8Array.from(program.ops));
  }
  static fromEncoded(v: BytesLike) {
    return new this(getBytes(v));
  }
  pos = 0;
  constructor(readonly ops: Uint8Array) {}
  get remaining() {
    return this.ops.length - this.pos;
  }
  checkRead(n: number) {
    if (this.pos + n > this.ops.length) throw new Error('reader overflow');
  }
  readByte() {
    this.checkRead(1);
    return this.ops[this.pos++];
  }
  readBytes(n: number) {
    this.checkRead(n);
    return hexlify(this.ops.subarray(this.pos, (this.pos += n)));
  }
  readNumber() {
    const n = this.readByte();
    return n ? parseInt(this.readBytes(n)) : 0;
  }
  readSmallStr() {
    return toUtf8String(this.readBytes(this.readByte()));
  }
  private parseArgs(op: number) {
    // TODO: this is probably incomplete
    switch (op) {
      //case OP.PUSH_0:
      case OP.PUSH_1:
      case OP.PUSH_2:
      case OP.PUSH_3:
      case OP.PUSH_4:
      case OP.PUSH_5:
      case OP.PUSH_6:
      case OP.PUSH_7:
      case OP.PUSH_8:
      case OP.PUSH_9:
      case OP.PUSH_10:
      case OP.PUSH_11:
      case OP.PUSH_12:
      case OP.PUSH_13:
      case OP.PUSH_14:
      case OP.PUSH_15:
      case OP.PUSH_16:
      case OP.PUSH_17:
      case OP.PUSH_18:
      case OP.PUSH_19:
      case OP.PUSH_20:
      case OP.PUSH_21:
      case OP.PUSH_22:
      case OP.PUSH_23:
      case OP.PUSH_24:
      case OP.PUSH_25:
      case OP.PUSH_26:
      case OP.PUSH_27:
      case OP.PUSH_28:
      case OP.PUSH_29:
      case OP.PUSH_30:
      case OP.PUSH_31:
      case OP.PUSH_32:
        return { bytes: this.readBytes(op) };
      case OP.PUSH_BYTES:
        return { bytes: this.readBytes(this.readNumber()) };
      case OP.EVAL_LOOP:
        return { flags: this.readByte() };
      case OP.DEBUG:
        return { label: this.readSmallStr() };
      default:
        return {};
    }
  }
  readAction(): ProgramAction {
    const op = this.readByte();
    const name = NAMES[op];
    if (!name) throw new Error(`unknown op: ${op}`);
    return { pos: this.pos, op, name, ...this.parseArgs(op) };
  }
}
