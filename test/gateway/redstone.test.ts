import { OPRollup } from '../../src/op/OPRollup.js';
import { testOP } from './common.js';

testOP(OPRollup.redstoneMainnetConfig, { skipCI: true });
