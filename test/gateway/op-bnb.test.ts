import { OPRollup } from '../../src/op/OPRollup.js';
import { testOP } from './common.js';

// 20241002: untested, unable to find bsc node sufficient eth_getProof depth
testOP(OPRollup.opBNBMainnetConfig, { skipCI: true });
