import { NitroRollup } from '../../src/nitro/NitroRollup.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@resolverworks/ezccip';
import { Foundry } from '@adraffy/blocksmith';
import { providerURL, createProviderPair } from '../../src/providers.js';
import { setupTests, testName } from './common.js';
import { afterAll } from 'bun:test';
import { describe } from '../bun-describe-fix.js';
import { testConfig } from '../../src/environment.js';

const config = NitroRollup.arb1MainnetConfig;
describe(testName(config), async () => {
  const rollup = new NitroRollup(
    createProviderPair(testConfig('ARB1'), config),
    config
  );
  const foundry = await Foundry.launch({
    fork: providerURL(testConfig('ARB1'), config.chain1),
    infoLog: false,
  });
  afterAll(() => foundry.shutdown());
  const gateway = new Gateway(rollup);
  const ccip = await serve(gateway, { protocol: 'raw', log: false });
  afterAll(() => ccip.http.close());
  const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
  const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
  const verifier = await foundry.deploy({
    file: 'NitroVerifier',
    args: [[ccip.endpoint], rollup.defaultWindow, hooks, rollup.L2Rollup],
    libs: { GatewayVM },
  });
  await setupTests(verifier, {
    // https://arbiscan.io/address/0xCC344B12fcc8512cc5639CeD6556064a8907c8a1#code
    slotDataContract: '0xCC344B12fcc8512cc5639CeD6556064a8907c8a1',
  });
});
