import { NitroRollup } from '../../src/arbitrum/NitroRollup.js';
import { testArbitrum } from './common.js';

testArbitrum(NitroRollup.apeMainnetConfig, { skipCI: true });
