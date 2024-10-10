import { OPFaultRollup } from '../../src/op/OPFaultRollup.js';
import { testOPFault } from './common.js';

testOPFault(
  { ...OPFaultRollup.mainnetConfig, minAgeSec: 3600 },
  {
    // https://optimistic.etherscan.io/address/0xf9d79d8c09d24e0C47E32778c830C545e78512CF
    slotDataContract: '0xf9d79d8c09d24e0C47E32778c830C545e78512CF',
    skipCI: true,
  }
);
