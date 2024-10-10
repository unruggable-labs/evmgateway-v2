import { Foundry } from '@adraffy/blocksmith';
import { serve } from '@resolverworks/ezccip';
import { ethers } from 'ethers';
import { createProviderPair, providerURL } from '../../src/providers.js';
import { LineaGatewayV1 } from '../../src/linea/LineaGatewayV1.js';
import { LineaRollup } from '../../src/linea/LineaRollup.js';
import { encodeShortString } from '../utils.js';
import { toPaddedHex } from '../../src/utils.js';
import { USER_CONFIG } from '../../src/environment.js';

// backend for linea.eth / https://names.linea.build/

const config = LineaRollup.mainnetConfig;
const rollup = new LineaRollup(createProviderPair(USER_CONFIG, config), config);
const gateway = new LineaGatewayV1(rollup);
const ccip = await serve(gateway, { protocol: 'raw' });

const foundry = await Foundry.launch({
  fork: providerURL(USER_CONFIG, config.chain1),
  infoLog: false,
});
const VERIFIER = '0x2aD1A39a3b616FB11ac5DB290061A0A5C09771f3';
const SLOT = BigInt(ethers.solidityPackedKeccak256(['uint256'], [0]));
await foundry.provider.send('anvil_setStorageAt', [
  VERIFIER,
  toPaddedHex(SLOT),
  encodeShortString(ccip.endpoint),
]);
const verifier = new ethers.Contract(
  VERIFIER,
  ['function gatewayURLs() external view returns (string[])'],
  foundry.provider
);
console.log('Hijacked:', await verifier.gatewayURLs());

await resolve('raffy.linea.eth');
// await resolve('premm.linea.eth');
// await resolve('tom.linea.eth');
await resolve('_dne123.linea.eth');

async function resolve(name: string) {
  console.log();
  console.log(name);
  const resolver = await foundry.provider.getResolver(name);
  if (!resolver) throw new Error('expected resolver');
  const [address, avatar] = await Promise.all([
    resolver.getAddress(),
    resolver.getAvatar(),
  ]);
  console.log({ address, avatar });
}

ccip.http.close();
await foundry.shutdown();
