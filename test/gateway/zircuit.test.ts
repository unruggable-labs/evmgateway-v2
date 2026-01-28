import { OPRollup } from '../../src/op/OPRollup.js';
import { testOP } from './common.js';

testOP(OPRollup.zircuitMainnetConfig, { skipCI: true });
