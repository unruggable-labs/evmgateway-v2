import { ZKSyncRollup } from '../../src/zksync/ZKSyncRollup.js';
import { createProviderPair } from '../providers.js';

const config = ZKSyncRollup.mainnetConfig;
const rollup = new ZKSyncRollup(createProviderPair(config), config);

console.log({
  DiamondProxy: rollup.DiamondProxy.target,
  defaultWindow: rollup.defaultWindow,
});

const commits = await rollup.fetchRecentCommits(10);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// [ 491155, 491154, 491153, 491152, 491151, 491150, 491149, 491148, 491147, 491146 ]
// [ 1, 1, 1, 1, 1, 1, 1, 1, 1 ]
