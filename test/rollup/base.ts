import { OPRollup } from '../../src/op/OPRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = OPRollup.baseMainnetConfig;
const rollup = new OPRollup(createProviderPair(USER_CONFIG, config), config);

console.log({
  L2OutputOracle: rollup.L2OutputOracle.target,
  defaultWindow: rollup.defaultWindow,
});

const commits = await rollup.fetchRecentCommits(10);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// [ 10444, 10443, 10442, 10441, 10440, 10439, 10438, 10437, 10436, 10435 ]
// [ 1, 1, 1, 1, 1, 1, 1, 1, 1 ]
