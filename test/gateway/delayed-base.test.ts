import { OPRollup } from '../../src/op/OPRollup.js';
import { testOP } from './common.js';

testOP(OPRollup.baseMainnetConfig, {
  // https://basescan.org/address/0x0C49361E151BC79899A9DD31B8B0CCdE4F6fd2f6
  slotDataContract: '0x0C49361E151BC79899A9DD31B8B0CCdE4F6fd2f6',
  // delay by 1 hour
  // NOTE: to delay longer, Gateway.commitDepth needs to be bigger
  minAgeSec: 3600,
  skipCI: true,
});
