import type { Chain, UserConfig } from './types.js';
import type { Rollup, RollupDeployment } from './rollup.js';
import { createProviderPair, createProvider } from './providers.js';
import { CHAINS } from './chains.js';
import { Gateway, GatewayV1 } from './gateway.js';
import { type OPConfig, OPRollup } from './op/OPRollup.js';
import { type OPFaultConfig, OPFaultRollup } from './op/OPFaultRollup.js';
import { ReverseOPRollup } from './op/ReverseOPRollup.js';
import { NitroRollup } from './nitro/NitroRollup.js';
import { ScrollRollup } from './scroll/ScrollRollup.js';
import { TaikoRollup } from './taiko/TaikoRollup.js';
import { LineaRollup } from './linea/LineaRollup.js';
import { LineaGatewayV1 } from './linea/LineaGatewayV1.js';
import { ZKSyncRollup } from './zksync/ZKSyncRollup.js';
import { PolygonPoSRollup } from './polygon/PolygonPoSRollup.js';
import { EthSelfRollup } from './eth/EthSelfRollup.js';
import { Contract } from 'ethers/contract';
import { toUnpaddedHex } from './utils.js';
import { ServerAdapterRequestHandler } from '@whatwg-node/server';

/**
 * Returns a fetch handler for the given gateway and config.
 */
export async function buildFetch(
  gateway: Gateway<Rollup> | GatewayV1<Rollup>,
  config: any
): Promise<ServerAdapterRequestHandler<any>> {
  const commit = await gateway.getLatestCommit();

  console.log({
    ...config,
    // TODO: add more stats
    commit: commit.index.toString(),
    cached: commit.prover.proofLRU.size,
  });

  return async (request: any) => {
    const headers = { 'access-control-allow-origin': '*' }; // TODO: cli-option to disable cors?

    switch (request.method) {
      case 'OPTIONS': {
        return new Response(null, {
          headers: { ...headers, 'access-control-allow-headers': '*' },
        });
      }
      case 'GET': {
        const commit = await gateway.getLatestCommit();
        return Response.json({
          ...config,
          // TODO: add more stats
          commit: commit.index.toString(),
          proofs: commit.prover.proofLRU.size,
          cached: commit.prover.proofLRU.size,
        });
      }
      case 'POST': {
        const t0 = performance.now();
        try {
          const { sender, data: calldata } = await request.json();
          const { data, history } = await gateway.handleRead(sender, calldata, {
            protocol: 'raw',
          });
          console.log(
            new Date(),
            history.toString(),
            Math.round(performance.now() - t0)
          );
          return Response.json({ data }, { headers });
        } catch (err) {
          const error = String(err);
          console.log(new Date(), error);
          return Response.json({ error }, { headers, status: 500 });
        }
      }
      default: {
        return new Response('unsupported', { status: 405 });
      }
    }
  };
}

export async function createGateway(userConfig: UserConfig) {
  switch (userConfig.CHAIN_NAME) {
    case 'op':
      return createOPFaultGateway(userConfig, OPFaultRollup.mainnetConfig);
    case 'unfinalized-op':
      return createOPFaultGateway(userConfig, {
        ...OPFaultRollup.mainnetConfig,
        minAgeSec: 6 * 3600,
      });
    case 'base-testnet':
      return createOPFaultGateway(userConfig, OPFaultRollup.baseTestnetConfig);
    case 'reverse-op': {
      const config = ReverseOPRollup.mainnetConfig;
      return new Gateway(
        new ReverseOPRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'arb1': {
      const config = NitroRollup.arb1MainnetConfig;
      return new Gateway(
        new NitroRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'linea': {
      const config = LineaRollup.mainnetConfig;
      return new Gateway(
        new LineaRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'lineaV1': {
      const config = LineaRollup.mainnetConfig;
      return new LineaGatewayV1(
        new LineaRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'polygon': {
      const config = PolygonPoSRollup.mainnetConfig;
      return new Gateway(
        new PolygonPoSRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'scroll': {
      const config = ScrollRollup.mainnetConfig;
      return new Gateway(
        new ScrollRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'scroll-testnet': {
      const config = ScrollRollup.testnetConfig;
      return new Gateway(
        new ScrollRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'taiko': {
      const config = TaikoRollup.mainnetConfig;
      return new Gateway(
        await TaikoRollup.create(createProviderPair(userConfig, config), config)
      );
    }
    case 'zksync': {
      const config = ZKSyncRollup.mainnetConfig;
      return new Gateway(
        new ZKSyncRollup(createProviderPair(userConfig, config), config)
      );
    }
    case 'base':
      return createOPGateway(userConfig, OPRollup.baseMainnetConfig);
    case 'blast':
      return createOPGateway(userConfig, OPRollup.blastMainnnetConfig);
    case 'celo-alfajores':
      return createOPGateway(userConfig, OPRollup.celoAlfajoresConfig);
    case 'cyber':
      return createOPGateway(userConfig, OPRollup.cyberMainnetConfig);
    case 'fraxtal':
      return createOPGateway(userConfig, OPRollup.fraxtalMainnetConfig);
    case 'mantle':
      return createOPGateway(userConfig, OPRollup.mantleMainnetConfig);
    case 'mode':
      return createOPGateway(userConfig, OPRollup.modeMainnetConfig);
    case 'opbnb':
      return createOPGateway(userConfig, OPRollup.opBNBMainnetConfig);
    case 'redstone':
      return createOPGateway(userConfig, OPRollup.redstoneMainnetConfig);
    case 'shape':
      return createOPGateway(userConfig, OPRollup.shapeMainnetConfig);
    case 'zora':
      return createOPGateway(userConfig, OPRollup.zoraMainnetConfig);
    case 'self-eth':
      return createSelfGateway(userConfig, CHAINS.MAINNET);
    case 'self-sepolia':
      return createSelfGateway(userConfig, CHAINS.SEPOLIA);
    case 'self-holesky':
      return createSelfGateway(userConfig, CHAINS.HOLESKY);
    default:
      throw new Error(`unknown gateway: ${name}`);
  }
}

function createSelfGateway(userConfig: UserConfig, chain: Chain) {
  return new Gateway(new EthSelfRollup(createProvider(userConfig, chain)));
}

function createOPGateway(
  userConfig: UserConfig,
  config: RollupDeployment<OPConfig>
) {
  return new Gateway(
    new OPRollup(createProviderPair(userConfig, config), config)
  );
}

function createOPFaultGateway(
  userConfig: UserConfig,
  config: RollupDeployment<OPFaultConfig>
) {
  return new Gateway(
    new OPFaultRollup(createProviderPair(userConfig, config), config)
  );
}

export function paramsFromRollup(rollup: Rollup) {
  const info: Record<string, any> = {};
  for (const [k, v] of Object.entries(rollup)) {
    switch (k) {
      case 'getLogsStepSize': // ignore
        continue;
    }
    if (v instanceof Contract) {
      info[k] = v.target;
    } else {
      switch (typeof v) {
        case 'bigint': {
          const i = Number(v);
          info[k] = Number.isInteger(i) ? i : toUnpaddedHex(v);
          break;
        }
        case 'string':
        case 'boolean':
        case 'number':
          info[k] = v;
          break;
      }
    }
  }
  return info;
}
