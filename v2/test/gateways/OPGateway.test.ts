import { OPGateway } from '../src/gateway/OPGateway.js';
import { ethers } from 'ethers';
import { serve } from '@resolverworks/ezccip';
import { Foundry } from '@adraffy/blocksmith';

const foundry = await Foundry.launch({
  fork: ethers.InfuraProvider.getRequest(ethers.Network.from(1)).url,
});

const base = OPGateway.base_mainnet({
  provider1: foundry.provider,
  provider2: new ethers.InfuraProvider(8453),
});

const ccip = await serve(base, { protocol: 'raw' });

// TODO:
// do foundry installs
// deploy verifier
// do full end-to-end

ccip.http.close();
foundry.shutdown();
