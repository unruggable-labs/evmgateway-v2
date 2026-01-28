import type { Chain, ChainPair, Override } from '../../src/types.js';
import type { RollupDeployment } from '../../src/rollup.js';
import { type TestDeployments, DEPLOYMENTS } from './deployments.js';
import { Gateway } from '../../src/gateway.js';
import {
  beaconURL,
  createProvider,
  createProviderPair,
  providerURL,
  providerName,
  PROVIDER_EVENTS,
} from '../providers.js';
import { chainName, CHAINS } from '../../src/chains.js';
import { serve } from '@namestone/ezccip/serve';
import { type FoundryContract, Foundry } from '@adraffy/blocksmith';
import { runSlotDataTests } from './SlotDataTests.js';
import { type OPConfig, OPRollup } from '../../src/op/OPRollup.js';
import {
  type OPFaultConfig,
  OPFaultRollup,
} from '../../src/op/OPFaultRollup.js';
import {
  type ScrollConfig,
  ScrollRollup,
} from '../../src/scroll/ScrollRollup.js';
import {
  type EuclidConfig,
  EuclidRollup,
} from '../../src/scroll/EuclidRollup.js';
import { type LineaConfig, LineaRollup } from '../../src/linea/LineaRollup.js';
import { type TaikoConfig, TaikoRollup } from '../../src/taiko/TaikoRollup.js';
import type { ArbitrumConfig } from '../../src/arbitrum/ArbitrumRollup.js';
import { BoLDRollup } from '../../src/arbitrum/BoLDRollup.js';
import { NitroRollup } from '../../src/arbitrum/NitroRollup.js';
import { DoubleArbitrumRollup } from '../../src/arbitrum/DoubleArbitrumRollup.js';
import {
  type ZKSyncConfig,
  ZKSyncRollup,
} from '../../src/zksync/ZKSyncRollup.js';
import { EthSelfRollup } from '../../src/eth/EthSelfRollup.js';
import { TrustedRollup } from '../../src/TrustedRollup.js';
import { EthProver } from '../../src/eth/EthProver.js';
import { randomBytes, SigningKey } from 'ethers/crypto';
import { ZeroAddress } from 'ethers/constants';
import { afterAll } from 'bun:test';
import { describe } from '../bun-describe-fix.js';
import { prefetchBoLD } from '../workarounds/prefetch-BoLD.js';
import { LATEST_BLOCK_TAG } from '../../src/utils.js';

PROVIDER_EVENTS.on('create', (chain) => {
  console.log(`* ${chainName(chain)} using ${providerName(chain)}`);
});

export function testName(
  { chain1, chain2, chain3 }: ChainPair & { chain3?: Chain },
  { reverse = false, unfinalized = false } = {}
) {
  const arrow = unfinalized ? ' =!=> ' : ' => ';
  const chains = [chain1, chain2];
  if (chain3 !== undefined) chains.push(chain3);
  const names = chains.map(chainName);
  if (reverse) names.reverse();
  return names.join(arrow);
}

type TestOptions = Partial<TestDeployments> & {
  log?: boolean;
  skipCI?: boolean;
  window?: number;
  quick?: boolean;
};

export function injectTestDeployment<T extends TestOptions>(
  chain: Chain,
  opts: T = {} as T
): Override<T, TestDeployments> {
  if (typeof opts.slotDataContract === 'string') {
    return opts as Override<T, TestDeployments>;
  }
  const name = chainName(chain);
  const deployment = DEPLOYMENTS[name];
  if (!deployment?.slotDataContract) {
    throw new Error(`missing SlotDataContract deployment: ${name}`);
  }
  return { ...deployment, ...opts };
}

export async function setupTests(
  verifier: FoundryContract,
  opts: TestDeployments & TestOptions
) {
  const foundry = Foundry.of(verifier);
  const reader = await foundry.deploy({
    file: 'SlotDataReader',
    args: [
      verifier,
      opts.slotDataContract,
      opts.slotDataPointer ?? ZeroAddress,
      [],
    ],
  });
  runSlotDataTests(reader, opts);
}

function shouldSkip(opts: TestOptions) {
  return !!opts.skipCI && !!process.env.IS_CI;
}

export function testOP(
  config: RollupDeployment<OPConfig>,
  options: TestOptions & { minAgeSec?: number } = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(
    testName(config, { unfinalized: !!opts.minAgeSec }),
    async () => {
      const rollup = new OPRollup(
        createProviderPair(config),
        config,
        opts.minAgeSec
      );
      await rollup.provider2.getBlockNumber(); // check provider
      const foundry = await Foundry.launch({
        fork: providerURL(config.chain1),
        infoLog: !!opts.log,
      });
      afterAll(foundry.shutdown);
      const gateway = new Gateway(rollup);
      const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
      afterAll(ccip.shutdown);
      const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
      const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
      const verifier = await foundry.deploy({
        file: 'OPVerifier',
        args: [
          [ccip.endpoint],
          rollup.defaultWindow,
          hooks,
          rollup.OptimismPortal,
          rollup.OutputFinder,
          rollup.minAgeSec,
        ],
        libs: { GatewayVM },
      });
      await setupTests(verifier, opts);
    }
  );
}

export function testOPFault(
  config: RollupDeployment<OPFaultConfig>,
  options: TestOptions & { minAgeSec?: number; realFinder?: boolean } = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(
    testName(config, { unfinalized: !!opts.minAgeSec }),
    async () => {
      const rollup = new OPFaultRollup(
        createProviderPair(config),
        config,
        opts.minAgeSec
      );
      const foundry = await Foundry.launch({
        fork: providerURL(config.chain1),
        infoLog: !!opts.log,
      });
      await rollup.provider2.getBlockNumber(); // check provider
      afterAll(foundry.shutdown);
      const gateway = new Gateway(rollup);
      const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
      afterAll(ccip.shutdown);
      const commit = await gateway.getLatestCommit();
      const gameFinder = await foundry.deploy(
        (opts.realFinder ?? !!process.env.REAL_FINDER)
          ? { file: 'OPFaultGameFinder' }
          : { file: 'FixedOPFaultGameFinder', args: [commit.index] }
      );
      const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
      const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
      const verifier = await foundry.deploy({
        file: 'OPFaultVerifier',
        args: [
          [ccip.endpoint],
          opts.window ?? rollup.defaultWindow,
          hooks,
          gameFinder,
          rollup.paramTuple,
        ],
        libs: { GatewayVM },
      });
      await setupTests(verifier, opts);
    }
  );
}

export function testArbitrum(
  config: RollupDeployment<ArbitrumConfig>,
  options: TestOptions & { minAgeBlocks?: number } = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(
    testName(config, { unfinalized: !!opts.minAgeBlocks }),
    async () => {
      const rollup = new (config.isBoLD ? BoLDRollup : NitroRollup)(
        createProviderPair(config),
        config,
        opts.minAgeBlocks
      );
      const foundry = await Foundry.launch({
        fork: providerURL(config.chain1),
        infoLog: !!opts.log,
      });
      afterAll(foundry.shutdown);
      const gateway = new Gateway(rollup);
      const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
      afterAll(ccip.shutdown);
      const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
      const EthVerifierHooks = await foundry.deploy({
        file: 'EthVerifierHooks',
      });
      const NitroVerifierLib = await foundry.deploy({
        file: 'NitroVerifierLib',
      });
      const BoLDVerifierLib = await foundry.deploy({ file: 'BoLDVerifierLib' });
      const verifier = await foundry.deploy({
        file: 'ArbitrumVerifier',
        args: [
          [ccip.endpoint],
          opts.window ?? rollup.defaultWindow,
          EthVerifierHooks,
          rollup.Rollup,
          rollup.minAgeBlocks,
          rollup.isBoLD,
        ],
        libs: { GatewayVM, NitroVerifierLib, BoLDVerifierLib },
      });
      if (rollup instanceof BoLDRollup) {
        await prefetchBoLD(foundry, rollup);
      }
      await setupTests(verifier, opts);
    }
  );
}

export function testScroll(
  config: RollupDeployment<ScrollConfig | EuclidConfig>,
  options: TestOptions = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(testName(config), async () => {
    const isScroll = 'poseidon' in config;
    const rollup = isScroll
      ? new ScrollRollup(createProviderPair(config), config)
      : new EuclidRollup(
          createProviderPair(config),
          config,
          beaconURL(config.chain1)
        );
    const foundry = await Foundry.launch({
      fork: providerURL(config.chain1),
      infoLog: !!opts.log,
    });
    afterAll(foundry.shutdown);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy(
      isScroll
        ? { file: 'ScrollVerifierHooks', args: [config.poseidon] }
        : { file: 'EthVerifierHooks' }
    );
    const verifier = await foundry.deploy({
      file: 'ScrollVerifier',
      args: [
        [ccip.endpoint],
        opts.window ?? rollup.defaultWindow,
        hooks,
        rollup.ScrollChain,
      ],
      libs: { GatewayVM },
    });
    await setupTests(verifier, opts);
  });
}

export function testSelfEth(chain: Chain, options: TestOptions = {}) {
  const opts = injectTestDeployment(chain, options);
  describe.skipIf(shouldSkip(opts))(chainName(chain), async () => {
    const foundry = await Foundry.launch({
      fork: providerURL(chain),
      infoLog: !!opts.log,
    });
    afterAll(foundry.shutdown);
    const rollup = new EthSelfRollup(foundry.provider);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
    const verifier = await foundry.deploy({
      file: 'SelfVerifier',
      args: [[ccip.endpoint], opts.window ?? rollup.defaultWindow, hooks],
      libs: { GatewayVM },
    });
    await setupTests(verifier, opts);
  });
}

export function testTrustedEth(chain2: Chain, options: TestOptions = {}) {
  const opts = injectTestDeployment(chain2, options);
  describe.skipIf(!!process.env.IS_CI)(
    testName({ chain1: CHAINS.VOID, chain2 }, { unfinalized: true }),
    async () => {
      const foundry = await Foundry.launch({
        fork: providerURL(chain2),
        infoLog: !!opts.log,
      });
      const rollup = new TrustedRollup(
        createProvider(chain2),
        EthProver,
        new SigningKey(randomBytes(32))
      );
      rollup.latestBlockTag = LATEST_BLOCK_TAG;
      afterAll(foundry.shutdown);
      const gateway = new Gateway(rollup);
      const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
      afterAll(ccip.shutdown);
      const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
      const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
      const verifier = await foundry.deploy({
        file: 'TrustedVerifier',
        args: [hooks, [ccip.endpoint], [rollup.signerAddress], 60],
        libs: { GatewayVM },
      });
      await setupTests(verifier, opts);
    }
  );
}

export function testLinea(
  config: RollupDeployment<LineaConfig>,
  options: TestOptions = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(testName(config), async () => {
    const rollup = new LineaRollup(createProviderPair(config), config);
    const foundry = await Foundry.launch({
      fork: providerURL(config.chain1),
      infoLog: !!opts.log,
    });
    afterAll(foundry.shutdown);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy({
      file: 'LineaVerifierHooks',
      libs: {
        SparseMerkleProof: config.SparseMerkleProof,
      },
    });
    const verifier = await foundry.deploy({
      file: 'LineaVerifier',
      args: [
        [ccip.endpoint],
        opts.window ?? rollup.defaultWindow,
        hooks,
        config.L1MessageService,
      ],
      libs: { GatewayVM },
    });
    await setupTests(verifier, opts);
  });
}

export function testZKSync(
  config: RollupDeployment<ZKSyncConfig>,
  options: TestOptions = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(testName(config), async () => {
    const rollup = new ZKSyncRollup(createProviderPair(config), config);
    const foundry = await Foundry.launch({
      fork: providerURL(config.chain1),
      infoLog: !!opts.log,
      infiniteCallGas: true, // Blake2s is ~12m gas per proof!
    });
    afterAll(foundry.shutdown);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const ZKSyncSMT = await foundry.deploy({ file: 'ZKSyncSMT' });
    const hooks = await foundry.deploy({
      file: 'ZKSyncVerifierHooks',
      args: [ZKSyncSMT],
    });
    const verifier = await foundry.deploy({
      file: 'ZKSyncVerifier',
      args: [
        [ccip.endpoint],
        opts.window ?? rollup.defaultWindow,
        hooks,
        rollup.DiamondProxy,
      ],
      libs: { GatewayVM },
    });
    await setupTests(verifier, opts);
  });
}

export function testTaiko(
  config: RollupDeployment<TaikoConfig>,
  options: TestOptions = {}
) {
  const opts = injectTestDeployment(config.chain2, options);
  describe.skipIf(shouldSkip(opts))(testName(config), async () => {
    const rollup = new TaikoRollup(createProviderPair(config), config);
    const foundry = await Foundry.launch({
      fork: providerURL(config.chain1),
      infoLog: !!opts.log,
    });
    afterAll(foundry.shutdown);
    const gateway = new Gateway(rollup);
    const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
    afterAll(ccip.shutdown);
    const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
    const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
    const verifier = await foundry.deploy({
      file: 'TaikoVerifier',
      args: [
        [ccip.endpoint],
        opts.window ?? rollup.defaultWindow,
        hooks,
        rollup.TaikoL1,
      ],
      libs: { GatewayVM },
    });
    await setupTests(verifier, opts);
  });
}

export function testDoubleArbitrum(
  config12: RollupDeployment<ArbitrumConfig>,
  config23: RollupDeployment<ArbitrumConfig>,
  options: TestOptions & {
    minAgeBlocks12?: number;
    minAgeBlocks23?: number;
  } = {}
) {
  const opts = injectTestDeployment(config23.chain2, options);
  describe.skipIf(shouldSkip(opts))(
    testName(
      { ...config12, chain3: config23.chain2 },
      { unfinalized: !!opts.minAgeBlocks12 || !!opts.minAgeBlocks23 }
    ),
    async () => {
      const rollup = new DoubleArbitrumRollup(
        new (config12.isBoLD ? BoLDRollup : NitroRollup)(
          createProviderPair(config12),
          config12,
          opts.minAgeBlocks12
        ),
        createProvider(config23.chain2),
        config23,
        opts.minAgeBlocks23
      );
      const foundry = await Foundry.launch({
        fork: providerURL(config12.chain1),
        infoLog: !!opts.log,
      });
      afterAll(foundry.shutdown);
      const gateway = new Gateway(rollup);
      const ccip = await serve(gateway, { protocol: 'raw', log: !!opts.log });
      afterAll(ccip.shutdown);
      const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
      const EthVerifierHooks = await foundry.deploy({
        file: 'EthVerifierHooks',
      });
      const NitroVerifierLib = await foundry.deploy({
        file: 'NitroVerifierLib',
      });
      const BoLDVerifierLib = await foundry.deploy({ file: 'BoLDVerifierLib' });
      const verifier = await foundry.deploy({
        file: 'DoubleArbitrumVerifier',
        args: [
          [ccip.endpoint],
          opts.window ?? rollup.defaultWindow,
          EthVerifierHooks,
          rollup.rollup12.Rollup,
          rollup.rollup12.minAgeBlocks,
          rollup.rollup12.isBoLD,
          rollup.request.toTuple(),
          //rollup.rollup23.isBoLD,
        ],
        libs: { GatewayVM, NitroVerifierLib, BoLDVerifierLib },
      });
      if (rollup.rollup12 instanceof BoLDRollup) {
        await prefetchBoLD(foundry, rollup.rollup12);
      }
      await setupTests(verifier, opts);
    }
  );
}
