import { Foundry } from '@adraffy/blocksmith';
import { serve } from '@namestone/ezccip/serve';
import { MorphRollup } from '../../src/morph/MorphRollup.js';
import { Gateway } from '../../src/gateway.js';
import { createProviderPair, providerURL } from '../providers.js';
import { injectTestDeployment, setupTests, testName } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';

const config = MorphRollup.mainnetConfig;
describe.skipIf(!!process.env.IS_CI)(testName(config), async () => {
  const rollup = new MorphRollup(createProviderPair(config), config);
  const foundry = await Foundry.launch({
    fork: providerURL(config.chain1),
    infoLog: false,
  });
  afterAll(foundry.shutdown);
  const gateway = new Gateway(rollup);
  const ccip = await serve(gateway, { protocol: 'raw', log: false });
  afterAll(ccip.shutdown);
  const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
  const hooks = await foundry.deploy({
    file: 'ScrollVerifierHooks',
    args: [rollup.poseidon],
  });
  const verifier = await foundry.deploy({
    file: 'ScrollVerifier',
    args: [[ccip.endpoint], rollup.defaultWindow, hooks, rollup.Rollup],
    libs: { GatewayVM },
  });
  await setupTests(verifier, injectTestDeployment(config.chain2));
});
