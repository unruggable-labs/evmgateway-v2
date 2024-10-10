import { createProviderPair } from '../providers.js';
import { OPFaultRollup } from '../../src/op/OPFaultRollup.js';
import { USER_CONFIG } from '../../src/environment.js';

for (const minAgeSec of [0, 86400, 3600, 1]) {
	const config = {...OPFaultRollup.baseTestnetConfig, minAgeSec};
	const rollup = new OPFaultRollup(createProviderPair(USER_CONFIG, config), config);
	const index = await rollup.fetchLatestCommitIndex();
	console.log(minAgeSec, index);
}
