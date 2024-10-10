import { GatewayRequest } from '../../src/vm.js';
import { EthProver } from '../../src/eth/EthProver.js';
import { Foundry } from '@adraffy/blocksmith';
import { test, afterAll, expect } from 'bun:test';
import { describe } from '../bun-describe-fix.js';

describe('microcode', async () => {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());

  async function compare(req1: GatewayRequest, req2: GatewayRequest) {
    const prover = await EthProver.latest(foundry.provider);
    // the requests should be different
    expect(req1.ops, 'program').not.toEqual(req2.ops);
    const vm1 = await prover.evalRequest(req1);
    const vm2 = await prover.evalRequest(req2);
    expect(vm1.exitCode, 'exitCode').toEqual(vm2.exitCode);
    const outputs1 = await vm1.resolveOutputs();
    const outputs2 = await vm2.resolveOutputs();
    // the outputs should be the same
    expect(outputs1, 'outputs').toEqual(outputs2);
    //console.log(req1.ops.length, req2.ops.length);
  }

  test('SLOT_FOLLOW == PUSH_SLOT CONCAT KECCAK SLOT', async () => {
    const contract = await foundry.deploy(`
      contract X {
        mapping (uint256 => uint256) map;
        constructor() {
          map[1] = 2;
        }
      }
    `);
    await compare(
      new GatewayRequest()
        .setTarget(contract.target)
        .push(1)
        .follow()
        .read()
        .addOutput(),
      new GatewayRequest()
        .setTarget(contract.target)
        .push(1)
        .pushSlot()
        .concat()
        .keccak()
        .slot()
        .read()
        .addOutput()
    );
  });

  test('SLOT_ADD == PUSH_SLOT PLUS SLOT', async () => {
    const contract = await foundry.deploy(`
      contract X { 
        uint256 pad; 
        uint256 x = 1;
      }
	`);
    await compare(
      new GatewayRequest()
        .setTarget(contract.target)
        .push(1)
        .addSlot()
        .read()
        .addOutput(),
      new GatewayRequest()
        .setTarget(contract.target)
        .pushSlot()
        .push(1)
        .plus()
        .slot()
        .read()
        .addOutput()
    );
  });

  test('PUSH_STACK(x) == PUSH_STACK_SIZE PUSH(1) SUBTRACT PUSH(x) SUBTRACT DUP', async () => {
    await compare(
      new GatewayRequest().push(123).pushStack(0).addOutput(),
      new GatewayRequest()
        .push(123)
        .pushStackSize() // length
        .push(1)
        .subtract() // length - 1
        .push(0) // index = 0
        .subtract() // (length - 1) - index
        .op('DUP')
        .addOutput()
    );
  });
});
