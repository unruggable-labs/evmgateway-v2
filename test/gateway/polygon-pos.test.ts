import { PolygonPoSRollup } from '../../src/polygon/PolygonPoSRollup.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@resolverworks/ezccip';
import { Foundry } from '@adraffy/blocksmith';
import { createProviderPair, providerURL } from '../../src/providers.js';
import { setupTests, testName } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';
import { testConfig } from '../../src/environment.js';
import { chainName } from '../../src/chains.js';

const config = PolygonPoSRollup.mainnetConfig;
// 20240923: disabled until polygon has non-erigon rpcs
describe.skipIf(!!process.env.IS_CI)(testName(config), async () => {
  const rollup = new PolygonPoSRollup(
    createProviderPair(testConfig(chainName(config.chain2)), config),
    config
  );
  rollup.configure = (c) => {
    c.prover.proofRetryCount = 5; // hack for failing eth_getProof
  };
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
    file: 'PolygonPoSVerifier',
    args: [
      [ccip.endpoint],
      rollup.defaultWindow,
      hooks,
      rollup.RootChain,
      rollup.poster,
    ],
    libs: { GatewayVM },
  });
  await setupTests(verifier, {
    // https://polygonscan.com/address/0x5BBf0fD3Dd8252Ee03bA9C03cF92F33551584361#code
    slotDataContract: '0x5BBf0fD3Dd8252Ee03bA9C03cF92F33551584361',
  });
});
