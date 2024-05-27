import {EVMRequest, EVMProver} from '../../src/vm.js';
import {Foundry} from '@adraffy/blocksmith';
import assert from 'node:assert/strict';
import {test, beforeAll} from 'bun:test';

test('FOLLOW === PUSH_SLOT CONCAT(2) KECCAK SET', async () => {

	let foundry = await Foundry.launch({infoLog: false});
	beforeAll(() => foundry.shutdown());

	let contract = await foundry.deploy({sol: `
		contract X {
			mapping (uint256 => uint256) map;
			constructor() {
				map[1] = 2;
			}
		}
	`});

	let prover = await EVMProver.latest(foundry.provider);

	let r1 = new EVMRequest().setTarget(contract.target).element(1).getValue();
	let r2 = new EVMRequest().setTarget(contract.target).push(1).pushSlotRegister().concat(2).keccak().set().getValue();

	assert.notDeepEqual(r1.ops, r2.ops);
	assert.deepEqual(await prover.execute(r1), await prover.execute(r2));

});