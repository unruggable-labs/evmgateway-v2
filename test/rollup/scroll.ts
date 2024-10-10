import { ScrollRollup } from '../../src/scroll/ScrollRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = ScrollRollup.mainnetConfig;
const rollup = new ScrollRollup(
  createProviderPair(USER_CONFIG, config),
  config
);

console.log({
  ScrollChain: rollup.ScrollChain.target,
  poseidon: rollup.poseidon,
  apiURL: rollup.apiURL,
  defaultWindow: rollup.defaultWindow,
});

const commits = await rollup.fetchRecentCommits(10);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// [ 310925, 310913, 310900, 310887, 310873, 310855, 310834, 310811, 310791, 310770 ]
// [ 12, 13, 13, 14, 18, 21, 23, 20, 21 ]
