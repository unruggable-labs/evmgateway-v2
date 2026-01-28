import { BoLDRollup } from '../../src/arbitrum/BoLDRollup.js';
import { testArbitrum } from './common.js';

testArbitrum(BoLDRollup.arbNovaMainnetConfig, { skipCI: true });
