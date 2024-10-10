import type { RollupDeployment } from '../rollup.js';
import type { HexAddress, ProviderPair } from '../types.js';
import { Contract } from 'ethers/contract';
import { PORTAL_ABI, GAME_FINDER_ABI } from './types.js';
import { CHAINS } from '../chains.js';
import { AbstractOPRollup, type OPCommit } from './AbstractOPRollup.js';

// https://docs.optimism.io/chain/differences
// https://specs.optimism.io/fault-proof/stage-one/bridge-integration.html

export type OPFaultConfig = {
  OptimismPortal: HexAddress;
  GameFinder: HexAddress;
  gameTypes?: number[]; // if empty, dynamically uses respectedGameType()
  minAgeSec?: number; // if falsy, requires finalization
};

type ABIFoundGame = {
  gameType: bigint;
  created: bigint;
  gameProxy: HexAddress;
  l2BlockNumber: bigint;
};

const GAME_FINDER_MAINNET = '0x475a86934805ef2c52ef61a8fed644d4c9ac91d8';
const GAME_FINDER_SEPOLIA = '0x4Bf352061FEB81a486A2fd325839d715bDc4038c';

function maskFromGameTypes(gameTypes: number[] = []) {
  return gameTypes.reduce((a, x) => a | (1 << x), 0);
}

export class OPFaultRollup extends AbstractOPRollup {
  // https://docs.optimism.io/chain/addresses
  static readonly mainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.OP,
    OptimismPortal: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
    GameFinder: GAME_FINDER_MAINNET,
  };

  // https://docs.base.org/docs/base-contracts/#ethereum-testnet-sepolia
  static readonly baseTestnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.BASE_SEPOLIA,
    OptimismPortal: '0x49f53e41452C74589E85cA1677426Ba426459e85',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // 20240917: delayed constructor not needed
  readonly OptimismPortal: Contract;
  readonly GameFinder: Contract;
  readonly gameTypeBitMask: number;
  readonly minAgeSec: number;
  constructor(providers: ProviderPair, config: OPFaultConfig) {
    super(providers);
    this.OptimismPortal = new Contract(
      config.OptimismPortal,
      PORTAL_ABI,
      providers.provider1
    );
    this.GameFinder = new Contract(
      config.GameFinder,
      GAME_FINDER_ABI,
      providers.provider1
    );
    this.minAgeSec = config.minAgeSec ?? 0;
    this.gameTypeBitMask = maskFromGameTypes(config.gameTypes);
  }

  async fetchRespectedGameType(): Promise<bigint> {
    return this.OptimismPortal.respectedGameType({
      blockTag: this.latestBlockTag,
    });
  }

  override async fetchLatestCommitIndex(): Promise<bigint> {
    // the primary assumption is that the anchor root is the finalized state
    // however, this is strangely conditional on the gameType
    // (apparently because the anchor state registry is *not* intended for finalization)
    // after a gameType switch, the finalized state "rewinds" to the latest game of the new type
    // to solve this, we use the latest finalized game of *any* supported gameType
    // 20240820: correctly handles the aug 16 respectedGameType change
    // TODO: this should be simplified in the future once there is a better policy
    // 20240822: once again uses a helper contract to reduce rpc burden
    return this.GameFinder.findGameIndex(
      this.OptimismPortal.target,
      this.minAgeSec,
      this.gameTypeBitMask,
      0,
      { blockTag: this.latestBlockTag }
    );
  }
  protected override async _fetchParentCommitIndex(
    commit: OPCommit
  ): Promise<bigint> {
    return this.GameFinder.findGameIndex(
      this.OptimismPortal.target,
      this.minAgeSec,
      this.gameTypeBitMask,
      commit.index
    );
  }
  protected override async _fetchCommit(index: bigint) {
    const game: ABIFoundGame = await this.GameFinder.gameAtIndex(
      this.OptimismPortal.target,
      this.minAgeSec,
      this.gameTypeBitMask,
      index
    );
    if (!game.l2BlockNumber) throw new Error('invalid game');
    return this.createCommit(index, game.l2BlockNumber);
  }

  override windowFromSec(sec: number): number {
    // finalization time is on-chain
    // https://github.com/ethereum-optimism/optimism/blob/a81de910dc2fd9b2f67ee946466f2de70d62611a/packages/contracts-bedrock/src/dispute/FaultDisputeGame.sol#L590
    return sec;
  }
}
