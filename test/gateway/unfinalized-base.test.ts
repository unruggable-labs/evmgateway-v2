import { OPFaultRollup } from '../../src/op/OPFaultRollup.js';
import { testOPFault } from './common.js';

testOPFault(OPFaultRollup.baseMainnetConfig, {
  minAgeSec: 21600,
  skipCI: false,
});
