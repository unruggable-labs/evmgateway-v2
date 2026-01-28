import { ZKSyncRollup } from '../../src/zksync/ZKSyncRollup.js';
import { testZKSync } from './common.js';

testZKSync(ZKSyncRollup.sepoliaConfig, { skipCI: true });
