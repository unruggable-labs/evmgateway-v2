import type { Provider, ProviderPair } from '../src/types.js';
import {
  Network,
  AlchemyProvider,
  InfuraProvider,
  JsonRpcProvider,
} from 'ethers/providers';

export const CHAIN_ARB1 = 42161;
export const CHAIN_BASE = 8453;
export const CHAIN_MAINNET = 1;

export function providerURL(chain: number): string {
  let key = process.env.INFURA_KEY;
  if (key) {
    try {
      return InfuraProvider.getRequest(Network.from(chain), key).url;
    } catch (err) {
      //
    }
  }
  key = process.env[`ALCHEMY_KEY_${chain}`];
  if (key) {
    try {
      return AlchemyProvider.getRequest(Network.from(chain), key).url;
    } catch (err) {
      //
    }
  }
  switch (chain) {
    case 1:
      return 'https://cloudflare-eth.com';
    case CHAIN_BASE:
      return 'https://mainnet.base.org';
    case CHAIN_ARB1:
      return 'https://arb1.arbitrum.io/rpc';
  }
  throw Object.assign(new Error('unknown provider'), { chain });
}

export function createProvider(chain: number): Provider {
  return new JsonRpcProvider(providerURL(chain), chain, {
    staticNetwork: true,
  });
}

export function createProviderPair(a: number, b?: number): ProviderPair {
  if (!b) {
    b = a;
    a = 1;
  }
  return {
    provider1: createProvider(a),
    provider2: createProvider(b),
  };
}
