import { EVMRequest, EVMProver } from '../../src/vm.js';
import { Foundry } from '@adraffy/blocksmith';
import { ethers } from 'ethers';
import { test, afterAll, expect } from 'bun:test';

test('ClowesConcatSlice', async () => {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());

  const SIZE = 73;
  const FIRST = 8;
  const LAST = 5;
  const VALUE = 1337;

  const data = ethers.hexlify(ethers.randomBytes(SIZE));
  const key = ethers.concat([
    ethers.dataSlice(data, 0, FIRST),
    ethers.dataSlice(data, -LAST),
  ]);

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

  const prover = await EVMProver.latest(foundry.provider);

  const r = new EVMRequest()
    .setTarget(contract.target)
    .setSlot(0)
    .getBytes() // #0
    .pushOutput(0)
    .slice(0, FIRST)
    .pushOutput(0)
    .slice(SIZE - LAST, LAST)
    .concat(2)
    .setSlot(1)
    .follow()
    .getValue(); // #1

  const outputs = await prover.execute(r);

  expect(outputs).toHaveLength(2);
  expect(outputs[0].value).toStrictEqual(data);
  expect(outputs[1].value).toStrictEqual(ethers.toBeHex(VALUE, 32));
});

test('PremmRegistryOfRegistries', async () => {
  const foundry = await Foundry.launch({ infoLog: false });
  afterAll(() => foundry.shutdown());

  const nodes = Array.from({ length: 10 }, (_, i) => `${i}`)
    .map((label, i, v) => {
      return {
        label: label,
        name: v.slice(i).join('.'),
        labelhash: ethers.id(label),
      };
    })
    .reverse();

  async function makeRegistry(label: string) {
    return foundry.deploy({
      sol: `
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
		`,
      args: [label],
    });
  }

  const root = await makeRegistry('root');

  {
    let prev = root;
    for (const node of nodes) {
      const next = await makeRegistry(node.name);
      await foundry.confirm(prev.register(node.labelhash, next));
      prev = next;
    }
  }

  const r = new EVMRequest();
  r.setTarget(root.target);

  for (const node of nodes) {
    r.push(node.labelhash).follow().getValue();
    r.pushOutput(r.outputCount - 1).target();
  }
  r.setSlot(1).getBytes();

  const prover = await EVMProver.latest(foundry.provider);

  console.time('Prove');
  const outputs = await prover.eval(r.ops, r.inputs);
  const [accountProofs, stateProofs] = await prover.prove(outputs);
  console.timeEnd('Prove');

  const values = await EVMProver.resolved(outputs);
  console.log(values);
  expect(ethers.toUtf8String(values[values.length - 1].value)).toStrictEqual(
    nodes[nodes.length - 1].name
  );

  const verifier = await foundry.deploy({
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

  console.time('Verify');
  console.log(
    await verifier.getStorageValues.estimateGas(
      [r.ops, r.inputs],
      await prover.getStateRoot(),
      accountProofs,
      stateProofs
    )
  );
  console.timeEnd('Verify');

  const response = ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes[][]', 'tuple(uint256, bytes[][])[]'],
    [accountProofs, stateProofs]
  );
  console.log(`Bytes: ${response.length}`);
});
