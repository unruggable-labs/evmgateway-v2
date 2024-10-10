import { NitroRollup } from '../../src/nitro/NitroRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = NitroRollup.arb1MainnetConfig;
const rollup = new NitroRollup(createProviderPair(USER_CONFIG, config), config);

console.log({
  L2Rollup: rollup.L2Rollup.target,
  defaultWindow: rollup.defaultWindow,
});

const commits = await rollup.fetchRecentCommits(10);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// [ 16132, 16131, 16130, 16129, 16128, 16127, 16126, 16125, 16124, 16123 ]
// [ 1, 1, 1, 1, 1, 1, 1, 1, 1 ]
