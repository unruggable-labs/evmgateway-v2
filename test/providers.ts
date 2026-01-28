/* eslint-disable prettier/prettier */
import type { Chain, ChainPair, Provider, ProviderPair } from '../src/types.js';
import { CHAINS, chainName } from '../src/chains.js';
import { FetchRequest } from 'ethers/utils';
import { GatewayProvider } from '../src/GatewayProvider.js';
import { EventEmitter } from 'node:events';

// 20240830: so far, alchemy has the best support
const DEFAULT_ORDER = ['alchemy', 'infura', 'ankr', 'drpc', 'public'];

export type RPCInfo = {
  readonly chain: Chain;
  readonly publicHTTP: string;
  readonly publicWS?: string;
  readonly publicBeacon?: string;
  readonly ankr?: string;
  readonly ankrPremium?: boolean;
  readonly ankrBeaconPremium?: boolean;
  readonly infura?: string;
  readonly alchemy?: string;
  readonly alchemyPremium?: boolean;
  readonly drpc?: string;
  readonly drpcBeacon?: string;
  readonly order?: string[];
};

// TODO: this list is incomplete!
// need to scrape all of the slugs and test rpc functionality and proof depth
// https://docs.metamask.io/services/get-started/endpoints/
// https://dashboard.alchemy.com/chains
// https://drpc.org/chainlist
export const RPC_INFO = new Map<Chain, RPCInfo>(
  (
    [
      {
        chain: CHAINS.MAINNET,
        publicHTTP: 'https://rpc.ankr.com/eth', // https://cloudflare-eth.com is too rate limited
        publicBeacon: 'https://ethereum-beacon-api.publicnode.com',
        ankr: 'eth',
        ankrBeaconPremium: true,
        infura: 'mainnet',
        alchemy: 'eth-mainnet',
        drpc: 'ethereum',
        drpcBeacon: 'eth-beacon-chain',
      },
      {
        chain: CHAINS.SEPOLIA,
        publicHTTP: 'https://rpc.ankr.com/eth_sepolia',
        publicBeacon: 'https://ethereum-sepolia-beacon-api.publicnode.com',
        ankr: 'eth_sepolia',
        //infura: 'sepolia', // 20251003: no eth_getProof depth
        //alchemy: 'eth-sepolia', // 20251003: no eth_getProof depth
        drpc: 'sepolia',
        drpcBeacon: 'eth-beacon-chain-sepolia',
      },
      {
        chain: CHAINS.HOLESKY,
        publicHTTP: 'https://rpc.ankr.com/eth_holesky', //'https://rpc.holesky.ethpandaops.io',
        publicBeacon: 'https://ethereum-holesky-beacon-api.publicnode.com',
        ankr: 'eth_holesky',
        infura: 'holesky',
        alchemy: 'eth-holesky',
        drpc: 'holesky',
        drpcBeacon: 'eth-beacon-chain-holesky',
      },
      {
        chain: CHAINS.HOODI,
        publicHTTP: 'https://ethereum-hoodi-rpc.publicnode.com',
        publicBeacon: 'https://ethereum-hoodi-beacon-api.publicnode.com',
        infura: 'hoodi',
        drpc: 'hoodi',
        drpcBeacon: 'eth-beacon-chain-hoodi',
      },
      {
        // https://docs.optimism.io/chain/networks#op-mainnet
        chain: CHAINS.OP,
        publicHTTP: 'https://mainnet.optimism.io',
        ankr: 'optimism',
        infura: 'optimism-mainnet',
        alchemy: 'opt-mainnet',
        drpc: 'optimism',
      },
      {
        // https://docs.optimism.io/chain/networks#op-sepolia
        chain: CHAINS.OP_SEPOLIA,
        publicHTTP: 'https://sepolia.optimism.io',
        ankr: 'optimism_sepolia',
        infura: 'optimism-sepolia',
        alchemy: 'opt-sepolia',
        drpc: 'optimism-sepolia',
      },
      {
        // https://docs.base.org/docs/network-information#base-mainnet
        chain: CHAINS.BASE,
        publicHTTP: 'https://mainnet.base.org',
        ankr: 'base',
        infura: 'base-mainnet',
        alchemy: 'base-mainnet',
        drpc: 'base',
        order: ['drpc', 'alchemy'],
      },
      {
        // https://docs.base.org/docs/network-information#base-testnet-sepolia
        chain: CHAINS.BASE_SEPOLIA,
        publicHTTP: 'https://sepolia.base.org',
        ankr: 'base_sepolia',
        infura: 'base-sepolia',
        alchemy: 'base-sepolia', // 20250107 eth_getProof depth now seems OK
        drpc: 'base-sepolia',
      },
      {
        // https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers#arbitrum-public-rpc-endpoints
        chain: CHAINS.ARB1,
        publicHTTP: 'https://arb1.arbitrum.io/rpc',
        ankr: 'arbitrum',
        infura: 'arbitrum-mainnet',
        alchemy: 'arb-mainnet',
        drpc: 'arbitrum',
      },
      {
        chain: CHAINS.ARB_NOVA,
        publicHTTP: 'https://nova.arbitrum.io/rpc',
        ankr: 'arbitrumnova',
        alchemy: 'arbnova-mainnet',
        drpc: 'arbitrum-nova',
      },
      {
        chain: CHAINS.ARB1_SEPOLIA,
        publicHTTP: 'https://sepolia-rollup.arbitrum.io/rpc',
        ankr: 'arbitrum_sepolia',
        infura: 'arbitrum-sepolia',
        alchemy: 'arb-sepolia',
        drpc: 'arbitrum-sepolia',
      },
      {
        // https://docs.scroll.io/en/developers/developer-quickstart/#scroll-mainnet
        chain: CHAINS.SCROLL,
        publicHTTP: 'https://rpc.scroll.io',
        ankr: 'scroll',
        infura: 'scroll-mainnet',
        alchemy: 'scroll-mainnet',
        drpc: 'scroll',
      },
      {
        chain: CHAINS.SCROLL_SEPOLIA,
        publicHTTP: 'https://sepolia-rpc.scroll.io',
        ankr: 'scroll_sepolia_testnet',
        infura: 'scroll-sepolia',
        alchemy: 'scroll-sepolia',
        drpc: 'scroll-sepolia',
      },
      {
        // https://docs.taiko.xyz/network-reference/rpc-configuration#taiko-mainnet
        chain: CHAINS.TAIKO,
        publicHTTP: 'https://rpc.mainnet.taiko.xyz',
        ankr: 'taiko',
        drpc: 'taiko',
      },
      {
        chain: CHAINS.TAIKO_HEKLA,
        publicHTTP: 'https://rpc.hekla.taiko.xyz',
        ankr: 'taiko_hekla',
        drpc: 'taiko-hekla',
      },
      {
        // https://docs.zksync.io/build/connect-to-zksync#mainnet-network-details
        chain: CHAINS.ZKSYNC,
        publicHTTP: 'https://mainnet.era.zksync.io',
        ankr: 'zksync_era',
        infura: 'zksync-mainnet',
        alchemy: 'zksync-mainnet',
        drpc: 'zksync',
      },
      {
        chain: CHAINS.ZKSYNC_SEPOLIA,
        publicHTTP: 'https://sepolia.era.zksync.dev',
        ankr: 'zksync_era_sepolia',
        infura: 'zksync-sepolia',
        alchemy: 'zksync-sepolia',
        drpc: 'zksync-sepolia',
      },
      {
        // https://docs.polygon.technology/pos/reference/rpc-endpoints/#mainnet
        chain: CHAINS.POLYGON_POS,
        publicHTTP: 'https://polygon-rpc.com',
        ankr: 'polygon',
        infura: 'polygon-mainnet',
        alchemy: 'polygon-mainnet',
      },
      {
        chain: CHAINS.POLYGON_AMOY,
        publicHTTP: 'https://rpc-amoy.polygon.technology',
        ankr: 'polygon_amoy',
        infura: 'polygon-amoy',
        alchemy: 'polygon-amoy',
      },
      {
        // https://docs.polygon.technology/zkEVM/get-started/quick-start/#manually-add-network-to-wallet
        chain: CHAINS.ZKEVM,
        publicHTTP: 'https://zkevm-rpc.com',
        ankr: 'polygon_zkevm',
        alchemy: 'polygonzkevm-mainnet',
      },
      {
        chain: CHAINS.ZKEVM_CARDONA,
        publicHTTP: 'https://rpc.cardona.zkevm-rpc.com',
        ankr: 'polygon_zkevm_cardona',
        alchemy: 'polygonzkevm-cardona',
      },
      {
        // https://docs.linea.build/developers/quickstart/info-contracts
        chain: CHAINS.LINEA,
        publicHTTP: 'https://rpc.linea.build',
        infura: 'linea-mainnet',
        //alchemy: 'linea-mainnet', // 20240901: linea_getProof doesn't work
        drpc: 'linea',
      },
      {
        chain: CHAINS.LINEA_SEPOLIA,
        publicHTTP: 'https://rpc.sepolia.linea.build',
        infura: 'linea-sepolia',
        //alchemy: 'linea-sepolia', // 20241111: no linea_getProof
        drpc: 'linea-sepolia',
      },
      {
        // https://docs.frax.com/fraxtal/network/network-information#fraxtal-mainnet
        chain: CHAINS.FRAXTAL,
        publicHTTP: 'https://rpc.frax.com',
        //alchemy: 'frax-mainnet', // 20240901: eth_getProof doesn't work
      },
      {
        // https://docs.zora.co/zora-network/network#zora-network-mainnet
        chain: CHAINS.ZORA,
        publicHTTP: 'https://rpc.zora.energy',
        alchemy: 'zora-mainnet',
      },
      {
        // https://docs.blast.io/building/network-information#blast-mainnet
        chain: CHAINS.BLAST,
        publicHTTP: 'https://rpc.blast.io',
        ankr: 'blast',
        infura: 'blast-mainnet',
        alchemy: 'blast-mainnet',
      },
      {
        // https://docs-v2.mantle.xyz/devs/dev-guides/tools/endpoints
        chain: CHAINS.MANTLE,
        publicHTTP: 'https://rpc.mantle.xyz',
        publicWS: 'wss://wss.mantle.xyz',
      },
      {
        chain: CHAINS.MANTLE_SEPOLIA,
        publicHTTP: 'https://rpc.sepolia.mantle.xyz',
      },
      {
        // https://docs.mode.network/general-info/network-details#mode-mainnet
        chain: CHAINS.MODE,
        publicHTTP: 'https://mainnet.mode.network',
      },
      {
        chain: CHAINS.MODE_SEPOLIA,
        publicHTTP: 'https://sepolia.mode.network',
      },
      {
        // https://docs.cyber.co/build-on-cyber/connecting-wallet
        chain: CHAINS.CYBER,
        publicHTTP: 'https://cyber.alt.technology',
      },
      {
        chain: CHAINS.CYBER_SEPOLIA,
        publicHTTP: 'https://cyber-testnet.alt.technology',
      },
      {
        // https://redstone.xyz/docs/network-info
        chain: CHAINS.REDSTONE,
        publicHTTP: 'https://rpc.redstonechain.com',
        publicWS: 'wss://rpc.redstonechain.com',
      },
      {
        // https://docs.gnosischain.com/about/networks/mainnet
        chain: CHAINS.GNOSIS,
        publicHTTP: 'https://rpc.gnosischain.com',
      },
      {
        // https://docs.shape.network/documentation/technical-details/network-information
        chain: CHAINS.SHAPE,
        publicHTTP: 'https://mainnet.shape.network',
        alchemy: 'shape-mainnet',
      },
      {
        // https://docs.bnbchain.org/bnb-smart-chain/
        chain: CHAINS.BSC,
        publicHTTP: 'https://bsc-dataseed.bnbchain.org',
        //infura: 'bsc-mainnet', // 20241002: eth_getProof doesn't work
        alchemy: 'bnb-mainnet',
        alchemyPremium: true,
        ankr: 'bsc',
        //drpc: 'bsc', // 20250115: random storage failures
      },
      {
        // https://docs.bnbchain.org/bnb-opbnb/get-started/network-info/
        chain: CHAINS.OP_BNB,
        publicHTTP: 'https://opbnb-mainnet-rpc.bnbchain.org',
        infura: 'opbnb-mainnet',
        alchemy: 'opbnb-mainnet',
        //drpc: 'opbnb', // 20250115: no depth
      },
      {
        // https://docs.celo.org/tooling/overview/network-overview#celo-mainnet
        chain: CHAINS.CELO,
        publicHTTP: 'https://forno.celo.org',
        publicWS: 'wss://forno.celo.org/ws',
        alchemy: 'celo-mainnet',
        infura: 'celo-mainnet',
        ankr: 'celo',
        drpc: 'celo',
      },
      {
        // https://docs.celo.org/tooling/overview/network-overview#celo-sepolia-testnet
        chain: CHAINS.CELO_SEPOLIA,
        publicHTTP: 'https://forno.celo-sepolia.celo-testnet.org',
        drpc: 'celo-sepolia',
      },
      {
        // https://docs.worldcoin.org/world-chain/quick-start/info
        chain: CHAINS.WORLD,
        publicHTTP: 'https://worldchain-mainnet.g.alchemy.com/public',
        alchemy: 'worldchain-mainnet',
      },
      {
        chain: CHAINS.WORLD_SEPOLIA,
        publicHTTP: 'https://worldchain-sepolia.g.alchemy.com/public',
        alchemy: 'worldchain-sepolia',
      },
      {
        // https://docs.apechain.com/metamask
        // https://apechain.hub.caldera.xyz/
        chain: CHAINS.APE,
        // https://apechain.calderachain.xyz/http
        publicHTTP: 'https://rpc.apechain.com/http',
        publicWS: 'wss://rpc.apechain.com/ws',
      },
      {
        // https://docs.zero.network/build-on-zero/network-information#zer%CE%B8-network
        chain: CHAINS.ZERO,
        publicHTTP: 'https://rpc.zerion.io/v1/zero',
      },
      {
        chain: CHAINS.ZERO_SEPOLIA,
        publicHTTP: 'https://rpc.zerion.io/v1/zero-sepolia',
      },
      {
        // https://docs.inkonchain.com/general/network-information
        chain: CHAINS.INK,
        publicHTTP: 'https://rpc-gel.inkonchain.com',
        publicWS: 'wss://rpc-gel.inkonchain.com',
        alchemy: 'ink-mainnet',
      },
      {
        chain: CHAINS.INK_SEPOLIA,
        publicHTTP: 'https://rpc-qnd-sepolia.inkonchain.com',
        publicWS: 'wss://rpc-qnd-sepolia.inkonchain.com',
        alchemy: 'ink-sepolia',
      },
      // https://docs.unichain.org/docs/technical-information/network-information
      {
        chain: CHAINS.UNICHAIN,
        publicHTTP: 'https://mainnet.unichain.org',
        infura: 'unichain-mainnet',
        //alchemy: 'unichain-mainnet',
      },
      {
        chain: CHAINS.UNICHAIN_SEPOLIA,
        publicHTTP: 'https://sepolia.unichain.org',
        infura: 'unichain-sepolia',
        alchemy: 'unichain-sepolia',
      },
      {
        // https://docs.morphl2.io/docs/build-on-morph/developer-resources/contracts
        chain: CHAINS.MORPH,
        publicHTTP: 'https://rpc-quicknode.morphl2.io',
      },
      {
        chain: CHAINS.MORPH_HOLESKY,
        publicHTTP: 'https://rpc-quicknode-holesky.morphl2.io',
      },
      {
        // https://docs.soneium.org/docs/builders/overview
        chain: CHAINS.SONEIUM,
        publicHTTP: 'https://rpc.soneium.org',
        alchemy: 'soneium-mainnet',
      },
      {
        chain: CHAINS.SONEIUM_SEPOLIA,
        publicHTTP: 'https://rpc.minato.soneium.org',
        alchemy: 'soneium-minato',
      },
      {
        // https://www.starknet.io/fullnodes-rpc-services/
        // https://docs.starknet.io/tools/api-services/
        chain: CHAINS.STARKNET,
        publicHTTP: 'https://rpc.starknet.lava.build',
        alchemy: 'starknet-mainnet',
        infura: 'starknet-mainnet',
      },
      {
        chain: CHAINS.STARKNET_SEPOLIA,
        publicHTTP: 'https://rpc.starknet-testnet.lava.build',
        alchemy: 'starknet-sepolia',
        infura: 'starknet-sepolia',
      },
      {
        // https://docs.zircuit.com/dev-tools/rpc-endpoints
        chain: CHAINS.ZIRCUIT,
        publicHTTP: 'https://zircuit1-mainnet.p2pify.com',
      },
      {
        chain: CHAINS.ZIRCUIT_SEPOLIA,
        publicHTTP: 'https://zircuit1-testnet.p2pify.com',
      },
      {
        // https://docs.lisk.com/network-info
        chain: CHAINS.LISK,
        publicHTTP: 'https://rpc.api.lisk.com',
      },
      {
        chain: CHAINS.LISK_SEPOLIA,
        publicHTTP: 'https://rpc.sepolia-api.lisk.com',
      },
      {
        // https://docs.abs.xyz/connect-to-abstract
        chain: CHAINS.ABSTRACT_SEPOLIA,
        publicHTTP: 'https://api.testnet.abs.xyz',
        publicWS: 'ws://api.testnet.abs.xyz/ws',
      },
      {
        // https://docs.mintchain.io/build/network
        chain: CHAINS.MINT,
        publicHTTP: 'https://rpc.mintchain.io',
        publicWS: 'wss://rpc.mintchain.io',
      },
      {
        chain: CHAINS.MINT_SEPOLIA,
        publicHTTP: 'https://sepolia-testnet-rpc.mintchain.io',
        publicWS: 'wss://sepolia-testnet-rpc.mintchain.io',
      },
      {
        // https://docs.gnosischain.com/about/networks/
        chain: CHAINS.GNOSIS,
        publicHTTP: 'https://rpc.gnosischain.com',
      },
      {
        chain: CHAINS.GNOSIS_CHIADO,
        publicHTTP: 'https://rpc.chiadochain.net',
      },
      {
        // https://docs.sophon.xyz/build/network-information
        chain: CHAINS.SOPHON,
        publicHTTP: 'https://rpc.sophon.xyz',
      },
      {
        chain: CHAINS.SOPHON_SEPOLIA,
        publicHTTP: 'https://rpc.testnet.sophon.xyz',
      },
      {
        // https://build.swellnetwork.io/docs/developer-resources/rpc-providers-and-bridges
        chain: CHAINS.SWELL,
        publicHTTP: 'https://swell-mainnet.alt.technology',
        ankr: 'swell',
        infura: 'swellchain-mainnet',
      },
      {
        chain: CHAINS.SWELL_SEPOLIA,
        publicHTTP: 'https://swell-testnet.alt.technology',
        //ankr: 'swell-testnet',
        infura: 'swellchain-testnet',
      },
      {
        // https://docs.gobob.xyz/learn/user-guides/networks
        chain: CHAINS.BOB,
        publicHTTP: 'https://rpc.gobob.xyz',
        publicWS: 'wss://rpc.gobob.xyz',
      },
      {
        chain: CHAINS.BOB_SEPOLIA,
        publicHTTP: 'https://bob-sepolia.rpc.gobob.xyz',
        publicWS: 'wss://bob-sepolia.rpc.gobob.xyz',
      },
    ] satisfies RPCInfo[]
  ).map((x) => [x.chain, x])
);

function envForChain(prefix: string, chain: Chain) {
  return (
    process.env[`${prefix}_${chainName(chain)}`] ||
    process.env[`${prefix}_${chain}`]
  );
}

export function providerOrder(chain?: Chain): string[] {
  const key = 'PROVIDER_ORDER';
  const orderings = [DEFAULT_ORDER]; // global default
  let env;
  if (chain) {
    const info = RPC_INFO.get(chain);
    if (info?.order) {
      orderings.push(info.order); // chain-specific default
    }
    env = envForChain(key, chain); // chain override?
  }
  if (!env) env = process.env[key]; // global override?
  if (env) {
    orderings.push(env.split(/[,\s+]/).flatMap((x) => x.trim() || []));
  }
  return [...new Set(orderings.reverse().flat())];
}

export const PROVIDER_EVENTS = new EventEmitter<{
  create: [chain: Chain, fr: FetchRequest];
}>();

type ProviderInfo = {
  info: RPCInfo;
  type: string;
  url: string;
  slug?: string;
  apiKey?: string;
};

export function decideProvider(chain: Chain, order?: string[]): ProviderInfo {
  const info = RPC_INFO.get(chain);
  if (!info) throw new Error(`unknown chain: ${chain}`);
  const env = envForChain('PROVIDER', chain);
  if (env) return { info, type: 'custom', url: env };
  order ??= providerOrder(chain);
  for (const type of order) {
    let slug, apiKey;
    switch (type) {
      case 'alchemy': {
        if (
          (slug = info.alchemy) &&
          (apiKey = process.env.ALCHEMY_KEY) &&
          (!info.alchemyPremium || !!process.env.ALCHEMY_PREMIUM)
        ) {
          return {
            info,
            type,
            slug,
            url: `https://${slug}.g.alchemy.com/v2/${apiKey}`,
            apiKey,
          };
        }
        break;
      }
      case 'ankr': {
        if (
          (slug = info.ankr) &&
          (apiKey = process.env.ANKR_KEY) &&
          (!info.ankrPremium || !!process.env.ANKR_PREMIUM)
        ) {
          return {
            info,
            type,
            slug,
            url: `https://rpc.ankr.com/${slug}/${apiKey}`,
            apiKey,
          };
        }
        break;
      }
      case 'infura': {
        if ((slug = info.infura) && (apiKey = process.env.INFURA_KEY)) {
          return {
            info,
            type,
            slug,
            url: `https://${slug}.infura.io/v3/${apiKey}`,
            apiKey,
          };
        }
        break;
      }
      case 'drpc': {
        if ((slug = info.drpc) && (apiKey = process.env.DRPC_KEY)) {
          return {
            info,
            type,
            slug,
            url: `https://lb.drpc.org/ogrpc?network=${slug}&dkey=${apiKey}`,
            apiKey,
          };
        }
        break;
      }
      case 'public': {
        return { info, type, url: info.publicHTTP };
      }
      default: {
        throw new Error(`unknown provider type: ${type}`);
      }
    }
  }
  throw new Error(`${chainName(chain)} unsupported by ${order}`);
}

export function providerURL(chain: Chain): string {
  return decideProvider(chain).url;
}

export function providerName(chain: Chain): string {
  return decideProvider(chain).type;
}

export function createProvider(chain: Chain): Provider {
  const info = decideProvider(chain);
  const fr = new FetchRequest(info.url);
  fr.timeout = 10000; // 5 minutes is too long
  // fr.preflightFunc = async (req) => {
  //   console.log(req.url);
  //   return req;
  // };
  PROVIDER_EVENTS.emit('create', chain, fr);
  return new GatewayProvider(fr, chain, info.type === 'drpc' ? 3 : 10);
}

export function createProviderPair(
  a: Chain | ChainPair,
  b?: Chain
): ProviderPair {
  if (typeof a !== 'bigint') {
    b = a.chain2;
    a = a.chain1;
  } else if (!b) {
    // if only 1 chain is provided => (mainnet, chain)
    b = a;
    a = CHAINS.MAINNET;
  }
  return {
    provider1: createProvider(a),
    provider2: createProvider(b),
  };
}

// https://docs.arbitrum.io/run-arbitrum-node/l1-ethereum-beacon-chain-rpc-providers
export function beaconURL(chain: Chain): string {
  const env = envForChain('BEACON', chain);
  if (env) return env;
  const info = RPC_INFO.get(chain);
  if (!info) throw new Error(`unknown chain: ${chain}`);
  let apiKey;
  if (info.drpcBeacon && (apiKey = process.env.DRPC_KEY)) {
    return `https://lb.drpc.org/rest/${apiKey}/${info.drpcBeacon}`;
  } else if (
    info.ankrBeaconPremium &&
    (apiKey = process.env.ANKR_KEY) &&
    process.env.ANKR_PREMIUM
  ) {
    return `https://rpc.ankr.com/premium-http/${info.ankr}_beacon/${apiKey}`;
  } else if (info.publicBeacon) {
    return info.publicBeacon;
  }
  throw new Error(`${chainName(chain)} beacon chain unsupported`);
}
