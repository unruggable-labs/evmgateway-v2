import { OPRollup } from '../../src/op/OPRollup.js';
import { testOP } from './common.js';

testOP(OPRollup.blastMainnnetConfig, {
  // delay by 1 hour
  // NOTE: to delay longer, Gateway.commitDepth needs to be bigger
  minAgeSec: 3600,
  skipCI: true,
});
