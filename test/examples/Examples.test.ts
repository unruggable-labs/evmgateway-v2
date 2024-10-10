import { GatewayRequest } from '../../src/vm.js';
import { EthProver } from '../../src/eth/EthProver.js';
import { Foundry } from '@adraffy/blocksmith';
import { hexlify, concat, dataSlice } from 'ethers/utils';
import { randomBytes } from 'ethers/crypto';
import { test, afterAll, expect } from 'bun:test';
import { toPaddedHex } from '../../src/utils.js';

test('ClowesConcatSlice', async () => {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());

  const SIZE = 73;
  const FIRST = 8;
  const LAST = 5;
  const VALUE = 1337;

  const data = hexlify(randomBytes(SIZE));
  const key = concat([dataSlice(data, 0, FIRST), dataSlice(data, -LAST)]);

  const contract = await foundry.deploy({
    sol: `
      contract C {
        bytes slot0;
        mapping (bytes => uint256) slot1;
        constructor(bytes memory data, bytes memory key, uint256 value) {
          slot0 = data;
          slot1[key] = value;
        }
      }
  `,
    args: [data, key, VALUE],
  });

  const prover = await EthProver.latest(foundry.provider);

  const req = new GatewayRequest(2)
    .setTarget(contract.target)
    .setSlot(0)
    .readBytes()
    .setOutput(0)
    .pushOutput(0)
    .slice(0, FIRST)
    .pushOutput(0)
    .slice(SIZE - LAST, LAST)
    .concat()
    .setSlot(1)
    .follow()
    .read()
    .setOutput(1);

  const values = await prover.evalRequest(req).then((r) => r.resolveOutputs());

  expect(values).toStrictEqual([data, toPaddedHex(VALUE)]);
});

test('SLOT_FOLLOW == PUSH_SLOT CONCAT KECCAK SLOT', async () => {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());
  const contract = await foundry.deploy({
    sol: `
      contract X {
        mapping (uint256 => uint256) map;
        constructor() {
          map[1] = 2;
        }
      }
    `,
  });
  await compare(
    await EthProver.latest(foundry.provider),
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
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());
  const contract = await foundry.deploy({
    sol: `
      contract X { 
        uint256 pad; 
        uint256 x = 1;
      }`,
  });
  await compare(
    await EthProver.latest(foundry.provider),
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

test('PUSH_STACK(i) == PUSH_STACK_SIZE PUSH(1) SUBTRACT PUSH(i) SUBTRACT DUP', async () => {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());
  await compare(
    await EthProver.latest(foundry.provider),
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

async function compare(
  prover: EthProver,
  req1: GatewayRequest,
  req2: GatewayRequest
) {
  // the requests should be different
  expect(req1.ops, 'program').not.toEqual(req2.ops);
  const vm1 = await prover.evalRequest(req1);
  const vm2 = await prover.evalRequest(req2);
  expect(vm1.exitCode, 'exitCode').toEqual(vm2.exitCode);
  const outputs1 = await vm1.resolveOutputs();
  const outputs2 = await vm2.resolveOutputs();
  // the outputs should be the same
  expect(outputs1, 'outputs').toEqual(outputs2);
}
