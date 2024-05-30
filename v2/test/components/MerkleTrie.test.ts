import type { HexString, BigNumberish } from '../../src/types.js';
import { EVMProver } from '../../src/vm.js';
import {
  proveAccountState,
  proveStorageValue,
  NULL_TRIE_HASH,
} from '../../src/merkle.js';
import { Foundry } from '@adraffy/blocksmith';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { afterAll, test } from 'bun:test';

// create a test builder because bun:test is retarded
async function setup() {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());
  await foundry.nextBlock(); // force mine a block
  return {
    foundry,
    async prover() {
      const prover = await EVMProver.latest(foundry.provider);
      return {
        async assertDoesNotExist(target: HexString) {
          const stateRoot = await prover.getStateRoot();
          const output = await prover.createOutput(target, 0n, 0);
          const [[accountProof]] = await prover.prove([output]);
          const accountState = proveAccountState(
            target,
            accountProof,
            stateRoot
          );
          assert.equal(accountState, undefined);
        },
        async assertValue(
          target: HexString,
          slot: BigNumberish,
          expect: BigNumberish
        ) {
          slot = ethers.getUint(slot);
          const stateRoot = await prover.getStateRoot();
          const output = await prover.createOutput(target, slot, 0);
          const [[accountProof], [[, [storageProof]]]] = await prover.prove([
            output,
          ]);
          const { storageHash } = await prover.getProof(target, [slot]);
          const accountState = proveAccountState(
            target,
            accountProof,
            stateRoot
          );
          assert.equal(accountState?.storageRoot, storageHash);
          const slotValue = proveStorageValue(slot, storageProof, storageHash);
          assert.equal(slotValue, await output.value());
          assert.equal(slotValue, ethers.toBeHex(expect, 32));
          const liveValue = await prover.provider.getStorage(target, slot);
          return {
            nullRoot: storageHash === NULL_TRIE_HASH,
            liveValue,
            slotValue,
            same: liveValue === slotValue,
          };
        },
      };
    },
  };
}

test(`nonexistent EOAs don't exist`, async () => {
  const T = await setup();
  const P = await T.prover();
  for (let i = 0; i < 5; i++) {
    await P.assertDoesNotExist(ethers.toBeHex(1, 20));
  }
});

test('EOA with balance exists', async () => {
  const T = await setup();
  const P = await T.prover();
  const V = await P.assertValue(T.foundry.wallets.admin.address, 0, 0);
  assert(V.nullRoot, 'expected null root');
});

test('empty contract', async () => {
  const T = await setup();
  const C = await T.foundry.deploy({ sol: `contract C {}` });
  const P = await T.prover();
  await P.assertValue(C.target, 0, 0);
});

test('slotless contract', async () => {
  const T = await setup();
  const C = await T.foundry.deploy({
    sol: `
		contract C {
			function set(uint256 slot, uint256 value) external {
				assembly { sstore(slot, value) }
			}
		}
	`,
  });
  const P1 = await T.prover();
  await P1.assertValue(C.target, 0, 0); // unset
  await T.foundry.confirm(C.set(0, 1)); // make change
  await P1.assertValue(C.target, 0, 0); // not visible to prover
  const P2 = await T.prover(); // new prover
  await P2.assertValue(C.target, 0, 1); // visible
});

test('slotted contract', async () => {
  const T = await setup();
  const C = await T.foundry.deploy({
    sol: `
		contract C {
			uint256 slot0 = 0;
			uint256 slot1 = 1;
			function set(uint256 slot, uint256 value) external {
				assembly { sstore(slot, value) }
			}
		}
	`,
  });
  const P1 = await T.prover();
  await P1.assertValue(C.target, 0, 0); // init
  await P1.assertValue(C.target, 1, 1); // init
  await P1.assertValue(C.target, 2, 0); // unset

  await T.foundry.confirm(C.set(0, 1)); // change slot 0
  await T.foundry.confirm(C.set(2, 1)); // change slot 2

  assert.equal(
    await P1.assertValue(C.target, 0, 0).then((x) => x.same),
    false,
    'expected slot(0) is diff'
  );
  assert.equal(
    await P1.assertValue(C.target, 1, 1).then((x) => x.same),
    true,
    'expected slot(1) is same'
  );
  assert.equal(
    await P1.assertValue(C.target, 2, 0).then((x) => x.same),
    false,
    'expected slot(2) is diff'
  );

  const P2 = await T.prover();
  await P2.assertValue(C.target, 0, 1); // new value
  await P2.assertValue(C.target, 2, 1); // new value
});
