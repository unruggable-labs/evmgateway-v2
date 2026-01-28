import { OPRollup } from '../../src/op/OPRollup.js';
import { testOP } from './common.js';

// TODO: check this
testOP(OPRollup.mintMainnetConfig, {
  minAgeSec: 1,
  window: 12 * 60 * 60,
  skipCI: true,
});
