import {Foundry, compile} from '@adraffy/blocksmith';
import {ethers} from 'ethers';
import {createProvider} from '../providers.js';

// https://etherscan.io/address/0x16D497651c4cB80680CA5A2D3Cd2764D32b36c73
let sol = `
contract GasTester {
	function hash(uint256 n, bytes32 x) external view returns (bytes32, uint256) {
		uint256 g = gasleft();
		for (uint256 i; i < n; i += 1) {
			assembly {
				mstore(0, x)
				x := keccak256(0, 32)
			}
		}
		return (x, g - gasleft());
	}

	function expand(uint256 n, uint256 m) external view returns (uint256) {
		uint256 g = gasleft();
		for (uint256 i; i < n; i += 1) {
			new bytes(m);
		}
		return g - gasleft();
	}
}`;

let foundry = await Foundry.launch();
let anvilProject = await foundry.deploy({sol});

async function deployPatch(optimize: number | boolean) { // TODO: fix this in blocksmith
	let {abi, bytecode} = await compile(sol, {optimize});
	return foundry.deploy({abi, bytecode});
}

let anvilOptimize200 = await deployPatch(200);
let anvilNoOptimize = await deployPatch(false);

let provider = createProvider(1);
let rpcNoOptimize = new ethers.Contract('0x16D497651c4cB80680CA5A2D3Cd2764D32b36c73', anvilProject.interface, provider);

// let anvilSame = await foundry.deploy({
// 	bytecode: ethers.concat(['0x608060405234801561001057600080fd5b506101fb806100206000396000f3fe', await provider.getCode(rpcNoOptimize.target)]),
// 	abi: anvilProject.interface
// });

async function compareExpand(n: number, m: number) {
	return Promise.all(Object.entries({
		//anvilProject,
		anvilOptimize200,
		anvilNoOptimize,
		rpcNoOptimize
	}).map(async ([name, c]) => {
		let estimate = Number(await c.expand.estimateGas(n, m));
		let actual = Number(await c.expand(n, m)) + 21000; // + arg cost
		return {name, estimate, actual};
	}));
}

console.log(await compareExpand(200, 10000));

foundry.shutdown();
