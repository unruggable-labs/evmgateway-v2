import { TaikoRollup } from '../../src/taiko/TaikoRollup.js';
import { testTaiko } from './common.js';

testTaiko(TaikoRollup.heklaConfig, { skipCI: true });
