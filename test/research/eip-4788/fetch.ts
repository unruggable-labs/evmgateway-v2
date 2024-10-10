// https://eips.ethereum.org/EIPS/eip-4788#beacon-block-root-instead-of-state-root

import { toPaddedHex } from '../../../src/utils.js';
import { CHAINS } from '../../../src/chains.js';
import { createProvider } from '../../../src/providers.js';

const provider = createProvider(CHAINS.OP);

// first deployment from 0x0B799C86a49DEeb90402691F1041aa3AF2d3C875
const BEACON_ROOTS_ADDRESS = '0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02';

const HISTORY_BUFFER_LENGTH = 8191;

const blockInfo = await provider.getBlock('finalized');
if (!blockInfo) throw new Error('wtf');

// these should all be the same
console.log(blockInfo.parentBeaconBlockRoot);
console.log(
  await provider.call({
    to: BEACON_ROOTS_ADDRESS,
    data: toPaddedHex(blockInfo.timestamp),
  })
);
console.log(
  await provider.getStorage(
    BEACON_ROOTS_ADDRESS,
    (blockInfo.timestamp % HISTORY_BUFFER_LENGTH) + HISTORY_BUFFER_LENGTH
  )
);
