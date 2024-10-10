import { ScrollRollup } from '../../src/scroll/ScrollRollup.js';
import { testScroll } from './common.js';

testScroll(ScrollRollup.testnetConfig, {
  // https://sepolia.scrollscan.com/address/0x57C2F437E0a5E155ced91a7A17bfc372C0aF7B05#code
  slotDataContract: '0x57C2F437E0a5E155ced91a7A17bfc372C0aF7B05',
  // https://sepolia.scrollscan.com/address/0xA2e3c1b0a43336A21E2fA56928bc7B7848c156A8#code
  slotDataPointer: '0xA2e3c1b0a43336A21E2fA56928bc7B7848c156A8',
  skipCI: true,
});
