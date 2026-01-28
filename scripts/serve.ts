import type { Serve } from 'bun';
import type { Provider, BigNumberish } from '../src/types.js';
import {
  type RollupDeployment,
  type RollupCommitType,
  supportsV1,
  isRollupDeployment,
} from '../src/rollup.js';
import {
  createProviderPair,
  createProvider,
  providerURL,
  beaconURL,
} from '../test/providers.js';
import { CHAINS, chainFromName, chainName } from '../src/chains.js';
import { Gateway } from '../src/gateway.js';
import { type OPConfig, OPRollup } from '../src/op/OPRollup.js';
import { type OPFaultConfig, OPFaultRollup } from '../src/op/OPFaultRollup.js';
import { ReverseOPRollup } from '../src/op/ReverseOPRollup.js';
import type { ArbitrumConfig } from '../src/arbitrum/ArbitrumRollup.js';
import { NitroRollup } from '../src/arbitrum/NitroRollup.js';
import { BoLDRollup } from '../src/arbitrum/BoLDRollup.js';
import { DoubleArbitrumRollup } from '../src/arbitrum/DoubleArbitrumRollup.js';
import { type ScrollConfig, ScrollRollup } from '../src/scroll/ScrollRollup.js';
import { type EuclidConfig, EuclidRollup } from '../src/scroll/EuclidRollup.js';
import { type TaikoConfig, TaikoRollup } from '../src/taiko/TaikoRollup.js';
import { type LineaConfig, LineaRollup } from '../src/linea/LineaRollup.js';
import { LineaGatewayV1 } from '../src/linea/LineaGatewayV1.js';
import { UnfinalizedLineaRollup } from '../src/linea/UnfinalizedLineaRollup.js';
import { type ZKSyncConfig, ZKSyncRollup } from '../src/zksync/ZKSyncRollup.js';
import { PolygonPoSRollup } from '../src/polygon/PolygonPoSRollup.js';
import { EthSelfRollup } from '../src/eth/EthSelfRollup.js';
import { TrustedRollup } from '../src/TrustedRollup.js';
import { UncheckedRollup } from '../src/UncheckedRollup.js';
import {
  flattenErrors,
  LATEST_BLOCK_TAG,
  toUnpaddedHex,
} from '../src/utils.js';
import { AbstractProver } from '../src/vm.js';
import { EthProver } from '../src/eth/EthProver.js';
//import { LineaProver } from '../src/linea/LineaProver.js';
import { ZKSyncProver } from '../src/zksync/ZKSyncProver.js';
import { Contract } from 'ethers/contract';
import { SigningKey } from 'ethers/crypto';
import { execSync } from 'child_process';

// NOTE: you can use CCIPRewriter to test an existing setup against a local gateway!
// [raffy] https://adraffy.github.io/ens-normalize.js/test/resolver.html#raffy.linea.eth.nb2hi4dthixs62dpnvss4ylooruxg5dvobuwiltdn5ws62duoryc6.ccipr.eth
// 1. bun serve lineaV1
// 2. https://adraffy.github.io/CCIPRewriter.sol/test/
// 3. enter name: "raffy.linea.eth"
// 4. enter endpoint: "http://localhost:8000"
// 5. click (Resolve)
// 6. https://adraffy.github.io/ens-normalize.js/test/resolver.html#raffy.linea.eth.nb2hi4b2f4xwy33dmfwgq33toq5dqmbqgaxq.ccipr.eth

let dumpAndExit = false;
let unfinalized: number | undefined = undefined;
let debugMode = false;
let printCalls = false;
let prefetch = false;
let latestBlockTag: BigNumberish = '';
let commitDepth: number | undefined = undefined;
let commitStep: number | undefined = undefined;
let gameTypes: bigint[] = [];
let disableFast = false;
let disableCache = false;
let disableDouble = false;
let signingKey =
  process.env.SIGNING_KEY ||
  '0xbd1e630bd00f12f0810083ea3bd2be936ead3b2fa84d1bd6690c77da043e9e02'; // 0xd00d from ezccip demo
const args = process.argv.slice(2).filter((x) => {
  let match: RegExpMatchArray | null;
  if (x === '--prefetch') {
    // Periodically pull the latest commit data into the cache so it's always fresh
    prefetch = true;
  } else if (x === '--latest') {
    // RPC calls will utilize the 'latest' block tag. Default is 'finalized'
    latestBlockTag = LATEST_BLOCK_TAG;
  } else if (
    (match = x.match(/^--blockTag=(-?(?:0x)?\d+|latest|finalized|safe)$/i))
  ) {
    latestBlockTag = BigInt(match[1]);
  } else if ((match = x.match(/^--unfinalized(|=\d+)$/))) {
    // Chain specific configuration value to indicate what unfinalized state is acceptable
    unfinalized = Math.max(1, parseInt(match[1].slice(1)) | 0);
  } else if ((match = x.match(/^--depth=(\d+)$/))) {
    commitDepth = parseInt(match[1]);
  } else if ((match = x.match(/^--step=(\d+)$/))) {
    commitStep = parseInt(match[1]);
  } else if ((match = x.match(/^--gameTypes=(\d+(?:,\d+)*)$/))) {
    gameTypes = match[1].split(',').map((x) => BigInt(x));
  } else if (x === '--dump') {
    dumpAndExit = true;
  } else if (x === '--debug') {
    // Display debug output
    debugMode = true;
  } else if (x === '--calls') {
    // Logs the RPC calls and their results for each provider
    printCalls = true;
  } else if (x === '--no-fast') {
    // Disables caching
    disableFast = true;
  } else if (x === '--no-cache') {
    // Disables caching
    disableCache = true;
  } else if (x === '--no-double') {
    disableDouble = true;
  } else if (/^0x[0-9a-f]{64}$/i.test(x)) {
    signingKey = x;
  } else {
    return true;
  }
  return;
});

const gateway = await createGateway(args[0]);
const port = parseInt(args[1] || process.env.PORT || '') || 8000;

if (args.length > 2) {
  throw new Error(`unknown args: ${args.join(' ')}`);
}
if (unfinalized && !gateway.rollup.unfinalized) {
  throw new Error('unfinalized not supported');
}

if (printCalls) {
  [gateway.rollup.provider1, gateway.rollup.provider2].forEach((p) => {
    p.on('debug', (x) => {
      if (x.action === 'sendRpcPayload') {
        console.log(chainName(p._network.chainId), x.action, x.payload);
      } else if (x.action == 'receiveRpcResult') {
        console.log(chainName(p._network.chainId), x.action, x.result);
      }
    });
  });
}

// how to configure gateway
if (gateway instanceof Gateway) {
  // gateway.commitDepth = 100;
  // gateway.allowHistorical = true;
  if (gateway.rollup instanceof TrustedRollup) {
    gateway.commitDepth = 0; // no need to keep expired signatures
  } else if (typeof commitDepth === 'number') {
    gateway.commitDepth = commitDepth;
  } else if (gateway.rollup.unfinalized) {
    gateway.commitDepth = 10;
  }
}
if (latestBlockTag) {
  gateway.rollup.latestBlockTag = latestBlockTag;
}
if (disableCache) {
  gateway.disableCache();
}

// how to configure prover
gateway.rollup.configure = (c: RollupCommitType<typeof gateway.rollup>) => {
  c.prover.printDebug = debugMode;
  c.prover.fast = !disableFast;
  // c.prover.maxStackSize = 5;
  // c.prover.maxUniqueProofs = 1;
  // c.prover.maxSuppliedBytes = 256;
  // c.prover.maxEvalDepth = 0;
};

const config = toJSON({
  git: ['git describe --tags --exact-match', 'git rev-parse HEAD'].reduce(
    (version, cmd) => {
      try {
        version ||= execSync(cmd, { stdio: 'pipe' }).toString().trim();
      } catch (_err) {
        // empty
      }
      return version;
    },
    ''
  ),
  gateway: gateway.constructor.name,
  rollup: gateway.rollup.constructor.name,
  unfinalized: gateway.rollup.unfinalized,
  chain1: chainDetails(gateway.rollup.provider1),
  chain2: chainDetails(gateway.rollup.provider2),
  since: new Date(),
  supportsV1: supportsV1(gateway.rollup),
  supportsV2: gateway instanceof Gateway,
  prefetch,
  callCacheSize: gateway.callLRU.max,
  ...toJSON(gateway),
  ...Object.fromEntries(
    await Promise.all(
      Object.entries(gateway.rollup).map(async ([k, v]) => {
        return [k, v instanceof Contract ? v.getAddress() : v];
      })
    )
  ),
});

if (gateway.rollup instanceof TrustedRollup) {
  config.signer = gateway.rollup.signerAddress;
}

if (gateway.rollup instanceof OPFaultRollup) {
  config.gameTypes = toJSONValue(await gateway.rollup.getGameTypes());
}

if (dumpAndExit) {
  console.log('Config:', config);
  const t0 = Date.now();
  const commit = await gateway.getLatestCommit();
  console.log('Prover:', proverDetails(commit.prover));
  console.log('Commit:', toJSON(commit), Date.now() - t0);
  console.log('Context:', toJSON(commit.prover.context));
  process.exit(0);
}

if (prefetch) {
  // periodically pull the latest commit so it's always fresh
  const fire = async () => {
    try {
      const t0 = Date.now();
      const commit = await gateway.getLatestCommit();
      console.log(
        new Date(),
        `Prefetch: index=${commit.index}`,
        commit.prover,
        Date.now() - t0
      );
    } catch (err) {
      console.log(new Date(), `Prefetch failed: ${flattenErrors(err, String)}`);
    }
    // this could use remainingCacheMs...
    // may be spammy when theres an issue
    // since it will fire at CachedValue.errorMs frequency
    setTimeout(fire, gateway.latestCache.cacheMs);
  };
  await fire();
}

console.log('Listening on', port, config);
const headers = { 'access-control-allow-origin': '*' }; // TODO: cli-option to disable cors?
export default {
  port,
  async fetch(req) {
    switch (req.method) {
      case 'OPTIONS': {
        return new Response(null, {
          headers: { ...headers, 'access-control-allow-headers': '*' },
        });
      }
      case 'GET': {
        const url = new URL(req.url);
        if (url.pathname === '/') {
          return Response.json(config, { headers });
        } else if (url.pathname === '/head') {
          const commit = await gateway.getLatestCommit();
          const [timestamp, stateRoot] = await Promise.all([
            commit.prover.fetchTimestamp(),
            commit.prover.fetchStateRoot(),
          ]);
          return Response.json(
            toJSON({
              commitIndex: commit.index,
              prover: commit.prover.context,
              timestamp,
              stateRoot,
            }),
            { headers }
          );
        } else if (debugMode && url.pathname === '/debug') {
          const commit = await gateway.getLatestCommit();
          const commits = [commit];
          if (gateway instanceof Gateway) {
            for (const p of await Promise.allSettled(
              Array.from(gateway.commitCacheMap.cachedKeys(), (i) =>
                gateway.commitCacheMap.cachedValue(i)
              )
            )) {
              if (
                p.status === 'fulfilled' &&
                p.value &&
                p.value.commit !== commit
              ) {
                commits.push(p.value.commit);
              }
            }
          }
          return Response.json(
            {
              ...config,
              prover: proverDetails(commit.prover),
              commits: commits.map((c) =>
                toJSON({
                  index: c.index,
                  prover: c.prover.context,
                  fetches: c.prover.cache.cachedSize,
                  proofs: c.prover.proofLRU.size,
                })
              ),
            },
            { headers }
          );
        } else {
          return new Response('file not found', { status: 404 });
        }
      }
      case 'POST': {
        const t0 = performance.now();
        try {
          const { sender, data: calldata } = await req.json();
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
          console.log(new Date(), flattenErrors(err, String));
          return Response.json(
            { error: flattenErrors(err) },
            { headers, status: 500 }
          );
        }
      }
      default: {
        return new Response('unsupported', { status: 405 });
      }
    }
  },
} satisfies Serve;

async function createGateway(name: string) {
  let match;
  if ((match = name.match(/^trusted:(.+)$/i))) {
    const chain = chainFromName(match[1]);
    const provider = createProvider(chain);
    const key = new SigningKey(signingKey);
    switch (chain) {
      case CHAINS.ZKSYNC:
      case CHAINS.ZKSYNC_SEPOLIA:
        return new Gateway(new TrustedRollup(provider, ZKSyncProver, key));
      // NOTE: linea should use eth_getProof instead of linea_getProof
      // NOTE: this probably needs "--latest" cli option too
      // rollup => SMT w/Mimc root using linea_getProof
      // chain => PMT w/Keccak root using eth_getProof
      // case CHAINS.LINEA:
      // case CHAINS.LINEA_SEPOLIA:
      //   return LineaProver;
      default: {
        return new Gateway(new TrustedRollup(provider, EthProver, key));
      }
    }
  } else if ((match = name.match(/^unchecked:(.+)$/i))) {
    const provider = createProvider(chainFromName(match[1]));
    return new Gateway(new UncheckedRollup(provider));
  } else if ((match = name.match(/^self:(.+)$/i))) {
    const chain = chainFromName(match[1]);
    return new Gateway(
      new EthSelfRollup(createProvider(chain), commitStep ?? 25) // 5 minutes (5*60/12)
    );
  } else if ((match = name.match(/^reverse:(.+)$/i))) {
    const chain = chainFromName(match[1]);
    const config = [
      ...deployments(OPFaultRollup),
      ...deployments(OPRollup),
    ].find((x) => x.chain2 === chain);
    if (!config) throw new Error(`irreversible: ${name}`);
    return new Gateway(
      new ReverseOPRollup(
        createProviderPair(config.chain2, config.chain1),
        commitStep ?? 150 // 5 minutes (5*60/2)
      )
    );
  } else if (/^v1:linea$/.test(name)) {
    const config = LineaRollup.mainnetConfig;
    return new LineaGatewayV1(
      new LineaRollup(createProviderPair(config), config)
    );
  }
  const chain = chainFromName(name);
  {
    const config = deployments<OPFaultConfig>(OPFaultRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      const rollup = new OPFaultRollup(
        createProviderPair(config),
        config,
        unfinalized
      );
      rollup.gameTypes = gameTypes;
      return new Gateway(rollup);
    }
  }
  {
    const config = deployments<OPConfig>(OPRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(
        new OPRollup(createProviderPair(config), config, unfinalized)
      );
    }
  }
  {
    const config = deployments<ArbitrumConfig>(BoLDRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(
        new BoLDRollup(createProviderPair(config), config, unfinalized)
      );
    }
  }
  {
    const config = deployments<ZKSyncConfig>(ZKSyncRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(new ZKSyncRollup(createProviderPair(config), config));
    }
  }
  {
    const config = deployments<EuclidConfig>(EuclidRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(
        new EuclidRollup(
          createProviderPair(config),
          config,
          beaconURL(config.chain1)
        )
      );
    }
  }
  {
    const config = deployments<ScrollConfig>(ScrollRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(new ScrollRollup(createProviderPair(config), config));
    }
  }
  {
    const config = deployments<TaikoConfig>(TaikoRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(
        new TaikoRollup(createProviderPair(config), config, commitStep)
      );
    }
  }
  {
    const config = deployments<LineaConfig>(LineaRollup).find(
      (x) => x.chain2 === chain
    );
    if (config) {
      return new Gateway(
        unfinalized
          ? new UnfinalizedLineaRollup(
              createProviderPair(config),
              config,
              unfinalized
            )
          : new LineaRollup(createProviderPair(config), config)
      );
    }
  }
  {
    const config23 = deployments<ArbitrumConfig>(NitroRollup).find(
      (x) => x.chain2 === chain
    );
    if (config23) {
      if (disableDouble) {
        return new Gateway(
          new NitroRollup(createProviderPair(config23), config23, unfinalized)
        );
      } else {
        const config12 = [
          ...deployments<ArbitrumConfig>(NitroRollup),
          ...deployments<ArbitrumConfig>(BoLDRollup),
        ].find((x) => x.chain2 === config23.chain1);
        if (!config12) throw new Error(`expected Arbitrum L3: ${name}`);
        return new Gateway(
          new DoubleArbitrumRollup(
            new (config12.isBoLD ? BoLDRollup : NitroRollup)(
              createProviderPair(config12),
              config12,
              unfinalized
            ),
            createProvider(config23.chain2),
            config23
          )
        );
      }
    }
  }
  switch (chain) {
    case CHAINS.POLYGON_POS: {
      const config = PolygonPoSRollup.mainnetConfig;
      return new Gateway(
        new PolygonPoSRollup(createProviderPair(config), config)
      );
    }
    default: {
      throw new Error(`unknown gateway: ${name}`);
    }
  }
}

function chainDetails(provider: Provider) {
  const chain = provider._network.chainId;
  if (chain < 0) return null;
  return toJSON({
    chain,
    name: chainName(chain),
    url: concealKeys(providerURL(chain)),
  });
}

function proverDetails(prover: AbstractProver) {
  const {
    maxUniqueProofs,
    proofBatchSize,
    maxSuppliedBytes,
    maxAllocBytes,
    maxEvalDepth,
    fast,
    printDebug,
  } = prover;
  return {
    prover: prover.constructor.name,
    maxUniqueProofs,
    proofBatchSize,
    maxSuppliedBytes,
    maxAllocBytes,
    maxEvalDepth,
    fast,
    printDebug,
    cache: {
      fetches: prover.cache.maxCached,
      proofs: prover.proofLRU.max,
    },
  };
}

function toJSONValue(x: any): any {
  switch (typeof x) {
    case 'bigint':
      return bigintToJSON(x);
    case 'string':
      return concealKeys(x);
    case 'boolean':
    case 'number':
      return x;
  }
  if (Array.isArray(x)) {
    return x.map(toJSONValue);
  } else if (x && x.constructor === Object) {
    return toJSON(x);
  }
}

function toJSON(x: object) {
  const json: Record<string, any> = {};
  for (const [k, v] of Object.entries(x)) {
    const value = toJSONValue(v);
    if (value !== undefined) {
      json[k] = value;
    }
  }
  return json;
}

// use number when it fits
function bigintToJSON(x: bigint) {
  const i = Number(x);
  return Number.isSafeInteger(i) ? i : toUnpaddedHex(x);
}

function concealKeys(s: string) {
  if (!s.startsWith('0x')) {
    for (const [k, v] of Object.entries(process.env)) {
      if (v && k.endsWith('_KEY')) {
        s = s.replace(v, `{${k}}`);
      }
    }
  }
  return s;
}

// hacky
function deployments<C>(rollupClass: object): RollupDeployment<C>[] {
  return Object.values(rollupClass).filter(isRollupDeployment<C>);
}
