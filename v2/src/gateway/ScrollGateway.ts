import {ethers} from 'ethers';
import type {BigNumberish, HexString, Proof, RPCEthGetBlock} from '../types.js';
import {AbstractCommit, AbstractGateway, ABI_CODER, type GatewayConstructor} from './AbstractGateway.js';
import {CachedValue} from '../cached.js';

type ScrollGatewayConstructor = {
	ScrollChainCommitmentVerifier: HexString;
	ScrollAPIURL: string;
};

class ScrollCommit extends AbstractCommit {
	constructor(
		index: bigint, 
		block: HexString,
		readonly blockHash: HexString,
		readonly stateRoot: HexString,
	) {
		super(index, block);
	}
}

export class ScrollGateway extends AbstractGateway<ScrollCommit> {
	static mainnet(a: GatewayConstructor) {
		// https://docs.scroll.io/en/developers/scroll-contracts/
		return new this({
			ScrollChainCommitmentVerifier: '0xC4362457a91B2E55934bDCb7DaaF6b1aB3dDf203',
			ScrollAPIURL: 'https://mainnet-api-re.scroll.io/api/',
			commitStep: 30n,
			...a,
		});
	}
	readonly poseidonCache: CachedValue<ethers.Contract>;
	//readonly rollupCache: CachedValue<ethers.Contract>;
	readonly ScrollAPIURL: string;
	readonly ScrollChainCommitmentVerifier: ethers.Contract;
	constructor(args: GatewayConstructor & ScrollGatewayConstructor) {
		super(args);
		this.ScrollAPIURL = args.ScrollAPIURL;
		this.ScrollChainCommitmentVerifier = new ethers.Contract(args.ScrollChainCommitmentVerifier, [
			'function rollup() view returns (address)',
			'function poseidon() view returns (address)',
			'function verifyZkTrieProof(address account, bytes32 storageKey, bytes calldata proof) view returns (bytes32 stateRoot, bytes32 storageValue)'
		], this.provider1);
		// this.rollupCache = new CachedValue(async () => {
		// 	return new ethers.Contract(await this.ScrollChainCommitmentVerifier.rollup(), [
		// 		`function lastFinalizedBatchIndex() view returns (uint256)`,
		// 	], this.provider1);
		// }, Infinity, 1000);
		this.poseidonCache = new CachedValue(async () => {
			return new ethers.Contract(await this.ScrollChainCommitmentVerifier.poseidon(), [
				'function poseidon(uint256[2], uint256) external view returns (bytes32)'
			], this.provider1);
		}, Infinity, 1000);
	}
	override encodeWitness(_: ScrollCommit, proofs: Proof[], order: Uint8Array) {
		return ABI_CODER.encode(['bytes[][]', 'bytes'], [proofs, order]);
	}
	override encodeWitnessV1(commit: ScrollCommit, accountProof: Proof, storageProofs: Proof[]) {
		let compressed = storageProofs.map(storageProof => ethers.concat([
			ethers.toBeHex(accountProof.length, 1), ...accountProof,
			ethers.toBeHex(storageProof.length, 1), ...storageProof,
		]));
		return ABI_CODER.encode(['tuple(uint256 batchIndex)', 'tuple(bytes, bytes[])'], [commit.index, ['0x', compressed]]);
	}
	async fetchBlockFromCommitIndex(index: bigint) {
		let url = new URL('./batch', this.ScrollAPIURL);
		url.searchParams.set('index', index.toString());
		let res = await fetch(url);
		if (!res.ok) throw new Error(`${res.url}: ${res.status}`);
		let json = await res.json();
		let {batch: {rollup_status, end_block_number}} = json;
		if (rollup_status != 'finalized') throw new Error(`not finalized: ${rollup_status}`);
		return '0x' + end_block_number.toString(16);
	}
	override async fetchLatestCommitIndex() {
		let res = await fetch(new URL('./last_batch_indexes', this.ScrollAPIURL))
		if (!res.ok) throw new Error(`${res.url}: ${res.status}`);
		let json = await res.json();
		return BigInt(json.finalized_index);
		// let rollup = await this.rollupCache.get();
		// return rollup.lastFinalizedBatchIndex();
	}
	override async fetchCommit(index: bigint): Promise<ScrollCommit> {
		let block = await this.fetchBlockFromCommitIndex(index);
		let {stateRoot, hash} = await this.provider2.send('eth_getBlockByNumber', [block, false]) as RPCEthGetBlock;
		return new ScrollCommit(index, block, hash, stateRoot); 
	}
	async poseidonHash(a: BigNumberish, b: BigNumberish, domain: BigNumberish): Promise<HexString> {
		let p = await this.poseidonCache.get();
		return p.poseidon([a, b], domain);
	}
}
