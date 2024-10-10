import { NitroRollup } from '../../src/nitro/NitroRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = NitroRollup.arb1MainnetConfig;
const rollup = new NitroRollup(createProviderPair(USER_CONFIG, config), {
  ...config,
  minAgeBlocks: 300, // 1 hr / (12 sec/block)
});

console.log({
  L2Rollup: rollup.L2Rollup.target,
  defaultWindow: rollup.defaultWindow,
});

console.log(new Date());
console.log(await rollup.fetchLatestNode(1));
console.log(await rollup.fetchLatestCommitIndex());
console.log(await rollup.fetchLatestNode(1000));
console.log(await rollup.fetchLatestNode());

const commits = await rollup.fetchRecentCommits(10);

const v = commits.map((x) => Number(x.index));
console.log(v);
console.log(v.slice(1).map((x, i) => v[i] - x));

// 2024-10-08T00:42:33.701Z
// 17546n
// 17545n
// 17543n
// 17394n
// [ 17545, 17544, 17543, 17542, 17541, 17540, 17539, 17538, 17537, 17536 ]
// [ 1, 1, 1, 1, 1, 1, 1, 1, 1 ]
