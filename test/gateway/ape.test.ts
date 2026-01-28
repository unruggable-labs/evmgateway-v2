import { BoLDRollup } from '../../src/arbitrum/BoLDRollup.js';
import { NitroRollup } from '../../src/arbitrum/NitroRollup.js';
import { testDoubleArbitrum } from './common.js';

// note: this requires 14-days of depth
testDoubleArbitrum(BoLDRollup.arb1MainnetConfig, NitroRollup.apeMainnetConfig, {
  skipCI: true,
});
