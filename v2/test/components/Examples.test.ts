import {EVMRequest, EVMProver} from '../../src/vm.js';
import {Foundry, type DeployedContract} from '@adraffy/blocksmith';
import {ethers} from 'ethers';
import {test, afterAll, expect} from 'bun:test';

test('ClowesConcatSlice', async () => {

	let foundry = await Foundry.launch({infoLog: false});
	afterAll(() => foundry.shutdown());

	const SIZE  = 73;
	const FIRST = 8;
	const LAST  = 5;
	const VALUE = 1337;

	let data = ethers.hexlify(ethers.randomBytes(SIZE));
	let key = ethers.concat([
		ethers.dataSlice(data, 0, FIRST),
		ethers.dataSlice(data, -LAST)
	]);

	let contract = await foundry.deploy({sol: `
		contract C {
			bytes slot0;
			mapping (bytes => uint256) slot1;
			constructor(bytes memory data, bytes memory key, uint256 value) {
				slot0 = data;
				slot1[key] = value;
			}
		}
	`, args: [data, key, VALUE]});

	let prover = await EVMProver.latest(foundry.provider);

	let r = new EVMRequest()
		.setTarget(contract.target)
		.setSlot(0).getBytes() // #0
		.pushOutput(0).slice(0, FIRST)
		.pushOutput(0).slice(SIZE - LAST, LAST)
		.concat(2)
		.setSlot(1).follow().getValue(); // #1

	let outputs = await prover.execute(r);

	expect(outputs).toHaveLength(2);
	expect(outputs[0].value).toStrictEqual(data);
	expect(outputs[1].value).toStrictEqual(ethers.toBeHex(VALUE, 32));

});
