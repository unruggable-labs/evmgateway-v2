import type {HexString, Provider, ProviderPair} from '../types.js';

import {ethers} from 'ethers';
import {EZCCIP} from '@resolverworks/ezccip';
import {SmartCache} from '../SmartCache.js';
import {EVMProver, EVMRequestV1} from '../vm.js';

const ABI_CODER = ethers.AbiCoder.defaultAbiCoder();

type GatewayConfig = {
	L2OutputOracle: HexString;
	L2ToL1MessagePasser?: HexString;
};

type Output = Readonly<{
	index: number;
	block: HexString;
	outputRoot: HexString;
	passerRoot: HexString;
	stateRoot: HexString;
	blockHash: HexString;
	cache: SmartCache;
}>;

const OutputRootProof = 'tuple(bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash)';
function outputRootProof(output: Output) {
	return [ethers.ZeroHash, output.stateRoot, output.passerRoot, output.blockHash];
}

export class OPGateway extends EZCCIP {
	static opMainnet(a: ProviderPair & Partial<GatewayConfig>) {
		// https://docs.optimism.io/chain/addresses
		return new this({
			L2OutputOracle: '0xdfe97868233d1aa22e815a266982f2cf17685a27',
			...a,
		});
	}
	static baseMainnet(a: ProviderPair & Partial<GatewayConfig>) {
		// https://docs.base.org/docs/base-contracts
		return new this({
			L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
			...a
		});
	}
	readonly provider1: Provider;
	readonly provider2: Provider;
	readonly L2ToL1MessagePasser: string;
	readonly L2OutputOracle: ethers.Contract;
	readonly callCache: SmartCache<string, string> = new SmartCache({max_cached: 100});
	readonly outputCache: SmartCache<number, Output> = new SmartCache({ms: 60*60000, max_cached: 10});
	constructor({provider1, provider2, L2OutputOracle, L2ToL1MessagePasser = '0x4200000000000000000000000000000000000016'}: ProviderPair & GatewayConfig) {
		super();
		this.provider1 = provider1;
		this.provider2 = provider2;
		this.L2ToL1MessagePasser = L2ToL1MessagePasser;
		this.L2OutputOracle = new ethers.Contract(L2OutputOracle, [
			'function latestOutputIndex() external view returns (uint256)',
			'function getL2Output(uint256 outputIndex) external view returns (tuple(bytes32 outputRoot, uint128 t, uint128 block))',
		], provider1);
		this.register(`getStorageSlots(address target, bytes32[] commands, bytes[] constants) external view returns (bytes)`, async ([target, commands, constants], context, history) => {
			let latest = await this.latestOutputIndex();
			let hash = ethers.id(`${latest}:${context.calldata}`);
			history.show = [hash];
			return this.callCache.get(hash, async () => {
				let output = await this.outputCache.get(latest, x => this.fetchOutput(x));
				let prover = new EVMProver(this.provider2, output.block, output.cache);
				let req = new EVMRequestV1(target, commands, constants).v2();
				let values = await prover.eval(req.ops, req.inputs);
				let [[accountProof], [_, storageProofs]] = await prover.prove(values);
				let witness = ABI_CODER.encode(
					[`tuple(uint256 outputIndex, ${OutputRootProof})`, 'tuple(bytes[], bytes[][])'],
					[[output.index, outputRootProof(output)], [accountProof, storageProofs]]
				);
				return ABI_CODER.encode(['bytes'], [witness]);
			});
		});
		this.register(`fetch(bytes context, tuple(bytes ops, bytes[] inputs)) returns (bytes)`, async ([index, {ops, inputs}], context, history) => {
			let hash = ethers.keccak256(context.calldata);
			history.show = [hash];
			return this.callCache.get(hash, async () => {
				index = parseInt(index);
				let latest = await this.latestOutputIndex();
				if (index < latest - this.outputCache.max_cached) throw new Error('stale');
				if (index > latest + 1) throw new Error('future');
				let output = await this.outputCache.get(index, x => this.fetchOutput(x));
				let prover = new EVMProver(this.provider2, output.block, output.cache);
				let values = await prover.eval(ethers.getBytes(ops), inputs);
				let [accountProofs, stateProofs] = await prover.prove(values);
				return ABI_CODER.encode(
					[OutputRootProof, 'bytes[][]', 'tuple(uint256, bytes[][])[]'],
					[outputRootProof(output), accountProofs, stateProofs]
				);
			});
		});
	}
	async latestOutputIndex(): Promise<number> {
		return this.outputCache.get(0, () => this.L2OutputOracle.latestOutputIndex().then(Number), 60000);
	}
	async fetchOutput(index: number): Promise<Output> {
		let {outputRoot, block} = await this.L2OutputOracle.getL2Output(index);
		block = '0x' + block.toString(16);
		let {storageHash: passerRoot} = await this.provider2.send('eth_getProof', [this.L2ToL1MessagePasser, [], block]);
		let details = await this.provider2.getBlock(block);
		if (!details || !details.stateRoot || !details.hash) throw Object.assign(new Error('shit block'), {block, details});
		return {
			index,
			block,
			outputRoot,
			passerRoot,
			stateRoot: details.stateRoot,
			blockHash: details.hash,
			cache: new SmartCache({max_cached: 512})
		};
	}
	shutdown() {
		this.provider1.destroy();
		this.provider2.destroy();
	}
}
