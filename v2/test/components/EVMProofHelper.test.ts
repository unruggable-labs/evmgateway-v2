import type { HexString } from '../../src/types.js';
import { ethers } from 'ethers';
import { Foundry, type DeployedContract } from '@adraffy/blocksmith';
import { EVMProver, EVMRequest } from '../../src/vm.js';
import {
  CHAIN_MAINNET,
  CHAIN_BASE,
  createProvider,
  providerURL,
} from '../providers.js';
import { decodeType } from '../utils.js';
import { beforeAll, afterAll, test } from 'bun:test';
import assert from 'node:assert/strict';

let foundry: Foundry;
let verifier: DeployedContract;
let prover: EVMProver;
let stateRoot: HexString;
beforeAll(async () => {
  foundry = await Foundry.launch({
    fork: providerURL(CHAIN_MAINNET),
    infoLog: false,
  });
  verifier = await foundry.deploy({
    sol: `
		import "@src/EVMProofHelper.sol";
		contract Verifier {
			function getStorageValues(
				EVMRequest memory req, 
				bytes32 stateRoot, 
				bytes[][] memory accountProofs, 
				StateProof[] memory stateProofs
			) external pure returns(bytes[] memory) {
				return EVMProofHelper.getStorageValues(req, stateRoot, accountProofs, stateProofs);
			}
		}
	`,
  });
  prover = await EVMProver.latest(createProvider(CHAIN_BASE));
  stateRoot = await prover.getStateRoot();
});
afterAll(async () => {
  await foundry?.shutdown();
});

async function prove(r: EVMRequest): Promise<HexString[]> {
  const outputs = await prover.eval(r.ops, r.inputs);
  const [accountProofs, stateProofs] = await prover.prove(outputs);
  return verifier.getStorageValues(
    [r.ops, r.inputs],
    stateRoot,
    accountProofs,
    stateProofs
  );
}

test('TeamNickPointer', async () => {
  // https://basescan.org/address/0x0f1449C980253b576aba379B11D453Ac20832a89
  const values = await prove(
    new EVMRequest()
      .setTarget('0x0f1449C980253b576aba379B11D453Ac20832a89')
      .getValue()
  );
  assert.equal(
    decodeType('address', values[0]),
    '0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f'
  );
});

test('TeamNickPointer => TeamNick.baseURI()', async () => {
  // https://basescan.org/address/0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f
  const values = await prove(
    new EVMRequest()
      .setTarget('0x0f1449C980253b576aba379B11D453Ac20832a89')
      .getValue()
      .pushOutput(0)
      .target()
      .setSlot(9)
      .getBytes()
  );
  assert.equal(ethers.toUtf8String(values[1]), 'https://teamnick.xyz/nft/');
});

test('firstTarget()', async () => {
  const r = new EVMRequest();
  r.push('0x0f1449C980253b576aba379B11D453Ac20832a89'); // TeamNickPointer
  r.push('0x51050ec063d393217B436747617aD1C2285Aeeee'); // EOA
  r.push('0x0000000000000000000000000000000000000000'); // doesn't exist
  r.firstTarget();
  r.getValue();
  const values = await prove(r);
  assert.equal(
    decodeType('address', values[0]),
    '0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f'
  );
});

test('replaceWithFirstNonzero()', async () => {
  const r = new EVMRequest();
  r.setTarget('0x0C49361E151BC79899A9DD31B8B0CCdE4F6fd2f6'); // TeamNick
  r.push(1);
  r.push('0x0000');
  r.pushBytes('0x'.padEnd(88, '0'));
  r.pushStr('');
  r.replaceWithFirstNonzero().add().getBytes();
  const values = await prove(r);
  assert.equal(ethers.toUtf8String(values[0]), 'Satoshi');
});

test('collectRange()', async () => {
  const values = await prove(
    new EVMRequest()
      .setTarget('0x7C6EfCb602BC88794390A0d74c75ad2f1249A17f')
      .getValues(20)
  );
  assert.equal(ethers.getBytes(values[0]).length, 20 << 5);
});
