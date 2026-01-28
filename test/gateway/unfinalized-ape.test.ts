import { BoLDRollup } from '../../src/arbitrum/BoLDRollup.js';
import { NitroRollup } from '../../src/arbitrum/NitroRollup.js';
import { testDoubleArbitrum } from './common.js';

testDoubleArbitrum(BoLDRollup.arb1MainnetConfig, NitroRollup.apeMainnetConfig, {
  skipCI: true,
  minAgeBlocks12: 1,
});
