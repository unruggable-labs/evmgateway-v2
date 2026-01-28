import { BoLDRollup } from '../../src/arbitrum/BoLDRollup.js';
import { testArbitrum } from './common.js';

testArbitrum(BoLDRollup.arb1MainnetConfig, {
  minAgeBlocks: 1,
});
