import type { Chain, HexAddress } from '../../src/types.js';
import { UncheckedRollup } from '../../src/UncheckedRollup.js';
import { chainName, CHAINS } from '../../src/chains.js';
import { Gateway } from '../../src/gateway.js';
import { serve } from '@namestone/ezccip/serve';
import { Foundry } from '@adraffy/blocksmith';
import { createProvider } from '../providers.js';
import { setupTests } from './common.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';

runTests({
  chain: CHAINS.MAINNET,
  slotDataContract: '0xC9D1E777033FB8d17188475CE3D8242D1F4121D5',
  slotDataPointer: '0xA537a7A8D9cE405a50d2e8aA00D4623E94E97d71',
});

function runTests(opts: {
  chain: Chain;
  slotDataContract: HexAddress;
  slotDataPointer?: HexAddress;
}) {
  describe(`unchecked: ${chainName(opts.chain)}`, async () => {
    const foundry = await Foundry.launch({ infoLog: false });
    const rollup = new UncheckedRollup(createProvider(opts.chain));
    afterAll(foundry.shutdown);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: false });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy({ file: 'UncheckedVerifierHooks' });
    const verifier = await foundry.deploy({
      file: 'UncheckedVerifier',
      args: [[ccip.endpoint], 60, hooks],
      libs: { GatewayVM },
    });
    await setupTests(verifier, opts);
  });
}
