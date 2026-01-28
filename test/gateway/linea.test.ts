import { LineaRollup } from '../../src/linea/LineaRollup.js';
import { testLinea } from './common.js';

testLinea(LineaRollup.mainnetConfig, {
  // 20250518: while there are shomei issues
  // currentL2BlockNumber() = 19123323
  // isShomeiReady() @ 18985856 => 137467 blocks * 2sec/block = 3.2 days
  window: 5 * 86400,
});
