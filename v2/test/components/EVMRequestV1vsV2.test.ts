import { EVMRequest, EVMRequestV1 } from '../../src/vm.js';
import { ethers } from 'ethers';
import assert from 'node:assert/strict';

const A = ethers.ZeroAddress;

test('getDynamic(8)', () => {
  const r1 = new EVMRequestV1(A).getDynamic(8);
  const r2 = new EVMRequest().setTarget(A).setSlot(8).getBytes();
  assert.deepEqual(r1.v2(), r2);
});

test('getDynamic(1).element(2)', () => {
  const r1 = new EVMRequestV1(A).getDynamic(1).element(2);
  const r2 = new EVMRequest().setTarget(A).setSlot(1).element(2).getBytes();
  assert.deepEqual(r1.v2(), r2);
});

test('getStatic(3).getStatic(4).ref(0)', () => {
  const r1 = new EVMRequestV1(A).getStatic(3).getStatic(4).ref(0);
  const r2 = new EVMRequest()
    .setTarget(A)
    .setSlot(3)
    .getValue()
    .setSlot(4)
    .elementOutput(0)
    .getValue();
  assert.deepEqual(r1.v2(), r2);
});

test('getDynamic(3).element(4).element(5).getStatic(6).element(bytes("raffy"))', () => {
  const r1 = new EVMRequestV1(A)
    .getDynamic(3)
    .element(4)
    .element(5)
    .getStatic(6)
    .elementStr('raffy');
  const r2 = new EVMRequest()
    .setTarget(A)
    .setSlot(3)
    .element(4)
    .element(5)
    .getBytes()
    .setSlot(6)
    .elementStr('raffy')
    .getValue();
  assert.deepEqual(r1.v2(), r2);
});
