import {EVMRequest, EVMProver} from '../../src/vm.js';
import {Foundry} from '@adraffy/blocksmith';
import {ethers} from 'ethers';
import assert from 'node:assert/strict';

let foundry = await Foundry.launch({infoLog: false});

let verifier = await foundry.deploy({sol: `
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
`});

//console.log(await nest(10));
//console.log(await nest(40));

let v: Awaited<ReturnType<typeof nest>>[] = [];
for (let n = 1; n <= 40; n++) {
	v.push(await nest(n));
	console.log(n);
}
console.log(JSON.stringify(v));

await foundry.shutdown();

async function nest(n: number) {

	let nodes = Array.from({length: n}, (_, i) => `${i}`).map((label, i, v) => {
		return {
			label: label,
			name: v.slice(i).join('.'),
			labelhash: ethers.id(label),
		};
	}).reverse();

	async function makeRegistry(label: string) {
		return foundry.deploy({sol: `
			contract Registry {
				mapping (bytes32 => address) _map;
				string _name;
				constructor(string memory name) {
					_name = name;
				}
				function register(bytes32 node, address to) external {
					_map[node] = to;
				}
			}
		`, args: [label]});
	}

	let root = await makeRegistry('root');

	{
		let prev = root;
		for (let node of nodes) {
			let next = await makeRegistry(node.name);
			await foundry.confirm(prev.register(node.labelhash, next));
			prev = next;
		}
	}

	let r = new EVMRequest();
	r.setTarget(root.target);
	for (let node of nodes) {
		r.push(node.labelhash).follow().getValue();
		r.pushOutput(r.outputCount-1).target();
	}
	r.setSlot(1).getBytes();

	let prover = await EVMProver.latest(foundry.provider);

	let prove_ms = performance.now();
	let outputs = await prover.eval(r.ops, r.inputs);
	let [accountProofs, stateProofs] = await prover.prove(outputs);
	prove_ms = performance.now() - prove_ms;

	let values = await EVMProver.resolved(outputs);
	assert.equal(ethers.toUtf8String(values[values.length-1].value), nodes[nodes.length-1].name); 

	let verify_ms = performance.now();
	let gas = Number(await verifier.getStorageValues.estimateGas([r.ops, r.inputs], await prover.getStateRoot(), accountProofs, stateProofs));
	verify_ms = performance.now() - verify_ms;

	let response = ethers.AbiCoder.defaultAbiCoder().encode(['bytes[][]', 'tuple(uint256, bytes[][])[]'], [accountProofs, stateProofs]);
	
	return {
		n,
		gas,
		bytes: response.length, // as 0x string
		prove_ms,
		verify_ms,
	};
}
