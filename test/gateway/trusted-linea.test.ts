import { testTrustedEth } from './common.js';
import { CHAINS } from '../../src/chains.js';

testTrustedEth(CHAINS.LINEA, { skipCI: true });
