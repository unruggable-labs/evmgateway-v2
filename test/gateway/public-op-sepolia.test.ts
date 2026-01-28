import { Foundry } from '@adraffy/blocksmith';
import { providerURL } from '../providers.js';
import { chainName } from '../../src/chains.js';
import { describe } from '../bun-describe-fix.js';
import { afterAll } from 'bun:test';
import { runSlotDataTests } from './SlotDataTests.js';
import { injectTestDeployment } from './common.js';
import { OPFaultRollup } from '../../src/index.js';

const config = OPFaultRollup.sepoliaConfig;
describe.skipIf(!!process.env.IS_CI)(
  `public: ${chainName(config.chain2)}`,
  async () => {
    const foundry = await Foundry.launch({
      fork: providerURL(config.chain1),
      infoLog: false,
    });
    afterAll(foundry.shutdown);
    const { slotDataContract, slotDataPointer } = injectTestDeployment(
      config.chain2
    );
    const contract = await foundry.deploy({
      file: 'SlotDataReader',
      args: [
        // OPFaultVerifier
        // https://gateway-docs.unruggable.com/verifiers/deployments?chain=op-sepolia
        // optimism-sepolia.verifier.unruggable.eth
        // https://optimism-sepolia.gateway.unruggable.com
        // https://sepolia.etherscan.io/address/0x5F1681D608e50458D96F43EbAb1137bA1d2A2E4D#readContract
        '0x5F1681D608e50458D96F43EbAb1137bA1d2A2E4D',
        slotDataContract,
        slotDataPointer,
        [],
      ],
    });
    runSlotDataTests(contract, { slotDataPointer: true });
  }
);
