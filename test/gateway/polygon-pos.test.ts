import { PolygonPoSRollup } from '../../src/polygon/PolygonPoSRollup.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@namestone/ezccip/serve';
import { Foundry } from '@adraffy/blocksmith';
import { createProviderPair, providerURL } from '../providers.js';
import { injectTestDeployment, setupTests, testName } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';

const config = PolygonPoSRollup.mainnetConfig;
// 20240923: disabled until polygon has non-erigon rpcs
describe.skipIf(!!process.env.IS_CI)(testName(config), async () => {
  const rollup = new PolygonPoSRollup(createProviderPair(config), config);
  const foundry = await Foundry.launch({
    fork: providerURL(config.chain1),
    infoLog: false,
  });
  afterAll(foundry.shutdown);
  const gateway = new Gateway(rollup);
  const ccip = await serve(gateway, { protocol: 'raw', log: false });
  afterAll(ccip.shutdown);
  const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
  const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
  const verifier = await foundry.deploy({
    file: 'PolygonPoSVerifier',
    args: [
      [ccip.endpoint],
      rollup.defaultWindow,
      hooks,
      rollup.RootChain,
      rollup.poster.address,
    ],
    libs: { GatewayVM },
  });
  await setupTests(verifier, injectTestDeployment(config.chain2));
});
