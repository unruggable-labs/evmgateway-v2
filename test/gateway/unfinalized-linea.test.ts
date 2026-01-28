import { LineaRollup } from '../../src/linea/LineaRollup.js';
import { UnfinalizedLineaRollup } from '../../src/linea/UnfinalizedLineaRollup.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@namestone/ezccip/serve';
import { Foundry } from '@adraffy/blocksmith';
import { createProviderPair, providerURL } from '../providers.js';
import { injectTestDeployment, setupTests, testName } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';

// NOTE: since shomei does not produce proofs before finalization
// this approach wont work however the verifier does work
// if the delay is set longer than the finalization period

const config = LineaRollup.mainnetConfig;
describe.skipIf(!!process.env.IS_CI)(
  testName(config, { unfinalized: true }),
  async () => {
    const rollup = new UnfinalizedLineaRollup(
      createProviderPair(config),
      config,
      (86400 * 2) / 12 // ~2 days of blocks >= finalization period
    );
    const foundry = await Foundry.launch({
      fork: providerURL(config.chain1),
      infoLog: false,
    });
    afterAll(foundry.shutdown);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, {
      protocol: 'raw',
      log: false,
    });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy({
      file: 'LineaVerifierHooks',
      libs: {
        SparseMerkleProof: config.SparseMerkleProof,
      },
    });
    const verifier = await foundry.deploy({
      file: 'UnfinalizedLineaVerifier',
      args: [
        [ccip.endpoint],
        rollup.defaultWindow,
        hooks,
        config.L1MessageService,
      ],
      libs: { GatewayVM },
    });
    await setupTests(verifier, injectTestDeployment(config.chain2));
  }
);
