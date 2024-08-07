import { NitroGateway } from '../../src/gateway/NitroGateway.js';
import { serve } from '@resolverworks/ezccip';
import { Foundry } from '@adraffy/blocksmith';
import { createProvider, providerURL, CHAIN_ARB1 } from '../providers.js';
import { runSlotDataTests, LOG_CCIP } from './tests.js';
import { describe, afterAll } from 'bun:test';

describe('arb1', async () => {
  const foundry = await Foundry.launch({
    fork: providerURL(1),
    infoLog: false,
  });
  afterAll(() => foundry.shutdown());
  const gateway = NitroGateway.arb1Mainnet({
    provider1: foundry.provider,
    provider2: createProvider(CHAIN_ARB1),
  });
  const ccip = await serve(gateway, {
    protocol: 'raw',
    port: 0,
    log: LOG_CCIP,
  });
  afterAll(() => ccip.http.close());
  const verifier = await foundry.deploy({
    file: 'NitroVerifier',
    args: [[ccip.endpoint], gateway.L2Rollup, gateway.blockDelay],
  });
  // https://arbiscan.io/address/0xCC344B12fcc8512cc5639CeD6556064a8907c8a1#code
  const reader = await foundry.deploy({
    file: 'SlotDataReader',
    args: [verifier, '0xCC344B12fcc8512cc5639CeD6556064a8907c8a1'],
  });
  runSlotDataTests(reader);
});
