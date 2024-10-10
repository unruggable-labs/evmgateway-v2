import { ReverseOPRollup } from '../../src/op/ReverseOPRollup.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@resolverworks/ezccip';
import { Foundry } from '@adraffy/blocksmith';
import { providerURL, createProviderPair } from '../../src/providers.js';
import { setupTests, testName } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';
import { USER_CONFIG } from '../../src/environment.js';

const config = ReverseOPRollup.mainnetConfig;
describe.skipIf(!!process.env.IS_CV)(
  testName(config, { reverse: true }),
  async () => {
    const foundry = await Foundry.launch({
      fork: providerURL(USER_CONFIG, config.chain2),
      infoLog: false,
    });
    afterAll(() => foundry.shutdown());
    const rollup = new ReverseOPRollup(
      createProviderPair(USER_CONFIG, config),
      config
    );
    // NOTE: prove against prefork block, since state diverged on our fork
    rollup.latestBlockTag = (await foundry.provider.getBlockNumber()) - 5;
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: false });
    afterAll(() => ccip.http.close());
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
    const verifier = await foundry.deploy({
      file: 'ReverseOPVerifier',
      args: [[ccip.endpoint], rollup.defaultWindow, hooks, rollup.L1Block],
      libs: { GatewayVM },
    });
    await setupTests(verifier, {
      // https://etherscan.io/address/0xC9D1E777033FB8d17188475CE3D8242D1F4121D5#code
      slotDataContract: '0xC9D1E777033FB8d17188475CE3D8242D1F4121D5',
    });
  }
);
