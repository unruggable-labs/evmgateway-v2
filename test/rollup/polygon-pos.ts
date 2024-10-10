import { PolygonPoSRollup } from '../../src/polygon/PolygonPoSRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = PolygonPoSRollup.mainnetConfig;
const rollup = new PolygonPoSRollup(
  createProviderPair(USER_CONFIG, config),
  config
);

console.log({
  RootChain: rollup.RootChain.target,
  apiURL: rollup.apiURL,
  poster: rollup.poster,
  defaultWindow: rollup.defaultWindow,
});

const commits = await rollup.fetchRecentCommits(5);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// [ 677870000, 677790000, 677750000, 677730000, 677680000 ]
// [ 80000, 40000, 20000, 50000 ]
