import { GatewayRequestV1, GatewayRequest, EthProver, CHAINS,  NitroRollup, OPRollup, TaikoRollup, ZKSyncRollup } from '../../src/index.js';
import { createProvider, createProviderPair } from '../providers.js';
import { USER_CONFIG } from '../../src/environment.js';

// this is just a worksheet

//console.log(createProvider(1n)._getConnection())

if (0) {
	const prover = await EthProver.latest(createProvider(CHAINS.MAINNET));
	console.log(prover);
	//console.log(await prover.supportsInterface('0x84c5AdB77dd9f362A1a3480009992d8d47325dc3', '0x73302a25'));
	throw 1;
}

if (0) {
	const config = ZKSyncRollup.mainnetConfig;
	const rollup = new ZKSyncRollup(createProviderPair(USER_CONFIG, config), config);
	//const commit = await rollup.fetchLatestCommit();
	const commit = await rollup.fetchLatestCommit();
	console.log(commit);
	throw 1;
}


if (0) {
	const config = OPRollup.baseMainnetConfig;
	const rollup = new OPRollup(createProviderPair(USER_CONFIG, config), config);
	//const commit = await rollup.fetchLatestCommit();
	const commit = await rollup.fetchCommit(0n);
	console.log(commit);
	throw 1;
}

if (0) {
	const config = NitroRollup.arb1MainnetConfig;
	const rollup = new NitroRollup(createProviderPair(USER_CONFIG, config), config);
	const commit = await rollup.fetchLatestCommit();
	console.log(commit);
	throw 1;
}

if (0) {
	const config = TaikoRollup.mainnetConfig;
	const rollup = await TaikoRollup.create(createProviderPair(USER_CONFIG, config), config);
	const commit = await rollup.fetchCommit(123124124n);
	console.log(await commit.prover.prove([{target: config.TaikoL1, required: true}]));
	throw 1;
}

if (1) {
	const config = ZKSyncRollup.mainnetConfig;
	const rollup = new ZKSyncRollup(createProviderPair(USER_CONFIG, config), config);
	const commit = await rollup.fetchLatestCommit();
	console.log(await commit.prover.prove([{target: config.DiamondProxy, required: true}]));
	throw 1;
}

//let foundry = await Foundry.launch({infoLog: false});

const prover = await EthProver.latest(createProvider(CHAINS.MAINNET));

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

// #0: mapping (bytes32 => Record) records; => struct Record { address owner; address resolver;	uint64 ttl; }
// #1: mapping (address => mapping(address => bool)) operators;
// #2: ENS _old

{
  const r = new GatewayRequest(1);
  r.push(ENS_REGISTRY).target();
  r.push(0).follow().read().setOutput(0); // owner of root: 0xaB528d626EC275E3faD363fF1393A41F581c5897
  const vm = await prover.evalRequest(r);
  console.log(await vm.resolveOutputs());
}

//console.log(await prover.execute(new GatewayRequest(0).setTarget(ENS_REGISTRY).element(0).getValue()));

//console.log(await prover.execute(new GatewayRequest().setTarget('0xE68d1aEeE2C17E43A955103DaB5E341eE439f55c').getValues(10)));

prover.provider.destroy();
//await foundry.shutdown();

const A = ENS_REGISTRY;
const r1 = new GatewayRequestV1(A).getStatic(3).getStatic(4).ref(0);
const r2 = new GatewayRequest()
  .setTarget(A)
  .setSlot(3)
  .read()
  .addOutput()
  .setSlot(4)
  .pushOutput(0)
  .follow()
  .read()
  .addOutput();

console.log(r1.v2());
console.log(r2);
