import { createProviderPair } from '../../src/providers.js';
import { OPFaultRollup } from '../../src/op/OPFaultRollup.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = OPFaultRollup.mainnetConfig;
const rollup = new OPFaultRollup(createProviderPair(USER_CONFIG, config), {
  ...config,
  minAgeSec: 3600,
});

console.log({
  OptimismPortal: rollup.OptimismPortal.target,
  GameFinder: rollup.GameFinder.target,
  respectedGameType: await rollup.fetchRespectedGameType(),
  defaultWindow: rollup.defaultWindow,
  minAgeSec: rollup.minAgeSec,
});

console.log(new Date());
console.log(await rollup.fetchLatestCommitIndex());
console.log(await new OPFaultRollup(rollup, config).fetchLatestCommitIndex());

const commits = await rollup.fetchRecentCommits(8);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// 2024-10-08T03:28:28.418Z
// 2886n
// 2804n
// [ 2886, 2885, 2884, 2883, 2882, 2881, 2880, 2879 ]
// [ 1, 1, 1, 1, 1, 1, 1 ]
