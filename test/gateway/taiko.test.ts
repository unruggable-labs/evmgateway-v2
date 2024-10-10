import { TaikoRollup } from '../../src/taiko/TaikoRollup.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@resolverworks/ezccip';
import { Foundry } from '@adraffy/blocksmith';
import { providerURL, createProviderPair } from '../../src/providers.js';
import { setupTests, testName } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';
import { testConfig } from '../../src/environment.js';
import { chainName } from '../../src/chains.js';

const config = TaikoRollup.mainnetConfig;
describe(testName(config), async () => {
  const rollup = await TaikoRollup.create(
    createProviderPair(testConfig(chainName(config.chain2)), config),
    config
  );
  const foundry = await Foundry.launch({
    fork: providerURL(testConfig(chainName(config.chain2)), config.chain1),
    infoLog: false,
  });
  afterAll(() => foundry.shutdown());
  const gateway = new Gateway(rollup);
  const ccip = await serve(gateway, { protocol: 'raw', log: false });
  afterAll(() => ccip.http.close());
  const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
  const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
  const verifier = await foundry.deploy({
    file: 'TaikoVerifier',
    args: [[ccip.endpoint], rollup.defaultWindow, hooks, rollup.TaikoL1],
    libs: { GatewayVM },
  });
  await setupTests(verifier, {
    // https://taikoscan.io/address/0xAF7f1Fa8D5DF0D9316394433E841321160408565#code
    slotDataContract: '0xAF7f1Fa8D5DF0D9316394433E841321160408565',
  });
});
