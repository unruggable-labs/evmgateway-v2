import { EthProver } from '../../src/eth/EthProver.js';
import { createProviderPair } from '../providers.js';
import { OPRollup } from '../../src/op/OPRollup.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = OPRollup.opBNBMainnetConfig;
const rollup = new OPRollup(createProviderPair(USER_CONFIG, config), config);
const index = await rollup.fetchLatestCommitIndex();
console.log({index});

const A = '0x0d3e01829E8364DeC0e7475ca06B5c73dbA33ef6';
const block = await rollup.provider2.getBlockNumber();
await new EthProver(rollup.provider2, block - 127).fetchProofs(A);
console.log(await new EthProver(rollup.provider2, block - 129).fetchProofs(A).catch(x => x));

console.log(await rollup.fetchCommit(index));
