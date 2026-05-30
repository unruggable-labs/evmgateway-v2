import { Interface } from 'ethers/abi';
import { Contract } from 'ethers/contract';
import { CHAINS } from '../chains.js';
import type { RollupDeployment } from '../rollup.js';
import type { HexAddress, HexString32, ProviderPair } from '../types.js';
import { isEthersError } from '../utils.js';
import {
  AbstractOPRollup,
  hashOutputRootProof,
  type AbstractOPCommit,
} from './AbstractOPRollup.js';

// https://docs.optimism.io/chain/differences
// https://specs.optimism.io/fault-proof/stage-one/bridge-integration.html

const ANCHOR_STATE_REGISTRY_ABI = new Interface([
  `function disputeGameFactory() view returns (address)`,
  `function respectedGameType() view returns (uint32)`,
  `function portal() view returns (address)`,
  `function isGameProper(address) view returns (bool)`,
]);

// const OPTIMISM_PORTAL_ABI = new Interface([
//   `function disputeGameFactory() view returns (address)`,
//   `function respectedGameType() view returns (uint32)`,
// ]);

const DISPUTE_GAME_FACTORY_ABI = new Interface([
  `function gameCount() view returns (uint256)`,
  `function gameAtIndex(uint256) view returns (uint256 gameType, uint256 created, address gameProxy)`,
]);

const GAME_ABI = new Interface([`function rootClaim() view returns (bytes32)`]);

const FINDER_ABI = new Interface([
  `error GameNotFound()`,
  `function findGameIndex((address portal, uint256 minAge, uint256[] allowedGameTypes, address[] allowedProposers), uint256 gameCount) view returns (uint256)`,
  `function gameAtIndex((address portal, uint256 minAge, uint256[] allowedGameTypes, address[] allowedProposers), uint256 gameIndex) view returns (
	 uint256 gameType, uint256 created, address gameProxy, uint256 l2BlockNumber, bytes32 rootClaim
   )`,
]);

export type OPFaultConfig = {
  AnchorStateRegistry: HexAddress;
  GameFinder: HexAddress;
};

export type OPFaultCommit = AbstractOPCommit & { game: ABIFoundGame };

export type OPFaultParamTuple = [HexAddress, bigint, bigint[], HexAddress[]];

type ABIFoundGame = {
  gameType: bigint;
  created: bigint;
  gameProxy: HexAddress;
  l2BlockNumber: bigint;
  rootClaim: string;
};

const FINDER_MAINNET = '0x981829755e38b16E6dc23762c1289CA3F4065682'; // 20251205
const FINDER_SEPOLIA = '0x8CB499cbfe991cAf2d6F18CcCC408dC8265eBE60'; // 20251205

export class OPFaultRollup extends AbstractOPRollup<OPFaultCommit> {
  static readonly ANCHOR_STATE_REGISTRY_ABI = ANCHOR_STATE_REGISTRY_ABI;
  static readonly DISPUTE_GAME_FACTORY_ABI = DISPUTE_GAME_FACTORY_ABI;
  static readonly GAME_ABI = GAME_ABI;
  static readonly FINDER_ABI = FINDER_ABI;

  static readonly FINDERS = new Map([
    [CHAINS.MAINNET, FINDER_MAINNET],
    [CHAINS.SEPOLIA, FINDER_SEPOLIA],
    //[CHAINS.HOLESKY, FINDER_HOLESKY],
    //[CHAINS.HOODI, FINDER_HOODI],
  ]);

  // https://docs.optimism.io/chain/addresses
  static readonly mainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.OP,
    AnchorStateRegistry: '0x23B2C62946350F4246f9f9D027e071f0264FD113',
    GameFinder: FINDER_MAINNET,
  };
  static readonly sepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.OP_SEPOLIA,
    AnchorStateRegistry: '0xa1Cec548926eb5d69aa3B7B57d371EdBdD03e64b',
    GameFinder: FINDER_SEPOLIA,
  };

  // https://docs.base.org/docs/base-contracts#l1-contract-addresses
  static readonly baseMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.BASE,
    AnchorStateRegistry: '0x909f6cf47ed12f010A796527f562bFc26C7F4E72',
    GameFinder: FINDER_MAINNET,
  };
  // https://docs.base.org/docs/base-contracts/#ethereum-testnet-sepolia
  static readonly baseSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.BASE_SEPOLIA,
    AnchorStateRegistry: '0x2fF5cC82dBf333Ea30D8ee462178ab1707315355',
    GameFinder: FINDER_SEPOLIA,
  };

  // https://docs.inkonchain.com/useful-information/contracts#l1-contract-addresses
  static readonly inkMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.INK,
    AnchorStateRegistry: '0xEe018bAf058227872540AC60eFbd38b023d9dAe2',
    GameFinder: FINDER_MAINNET,
  };
  static readonly inkSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.INK_SEPOLIA,
    AnchorStateRegistry: '0x299D7Ea9f0B584cfaF2a5341D151B44967594cA9',
    GameFinder: FINDER_SEPOLIA,
  };

  // https://docs.unichain.org/docs/technical-information/contract-addresses
  static readonly unichainMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.UNICHAIN,
    AnchorStateRegistry: '0x27Cf508E4E3Aa8d30b3226aC3b5Ea0e8bcaCAFF9',
    GameFinder: FINDER_MAINNET,
  };
  static readonly unichainSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.UNICHAIN_SEPOLIA,
    AnchorStateRegistry: '0xBb6cA820978442750B682663efA851AD4131127b',
    GameFinder: FINDER_SEPOLIA,
  };

  // https://docs.soneium.org/docs/builders/contracts
  static readonly soneiumMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SONEIUM,
    AnchorStateRegistry: '0x4890928941e62e273dA359374b105F803329F473',
    GameFinder: FINDER_MAINNET,
  };
  static readonly soneiumMinatoConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.SONEIUM_SEPOLIA,
    AnchorStateRegistry: '0x90066735EE774b405C4f54bfeC05b07f16D67188',
    GameFinder: FINDER_SEPOLIA,
  };

  // https://build.swellnetwork.io/docs/developer-resources/contract-addresses
  static readonly swellMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SWELL,
    AnchorStateRegistry: '0x511fB9E172f8A180735ACF9c2beeb208cD0061Ac',
    GameFinder: FINDER_MAINNET,
  };
  // 20251115: ASR is Old
  // - OptimismPortal: '0x595329c60c0b9e54a5246e98fb0fa7fcfd454f64'
  // - GameFinder: '0x505e1e172667fec4a55514ccfc7fd240b409a299'
  // static readonly swellSepoliaConfig: RollupDeployment<OPFaultConfig> = {
  //   chain1: CHAINS.SEPOLIA,
  //   chain2: CHAINS.SWELL_SEPOLIA,
  //   AnchorStateRegistry: '0x6D1443dD3f58889C6A8DE51E74b5fCa9c7116513',
  //   GameFinder: FINDER_SEPOLIA,
  // };

  // https://docs.worldcoin.org/world-chain/developers/world-chain-contracts
  // 20251115: ASR is Old
  // - OptimismPortal: '0xd5ec14a83B7d95BE1E2Ac12523e2dEE12Cbeea6C'
  // - GameFinder: '0x61F50A76bfb2Ad8620A3E8F81aa27f3bEb1Db0D7'
  // static readonly worldMainnetConfig: RollupDeployment<OPFaultConfig> = {
  //   chain1: CHAINS.MAINNET,
  //   chain2: CHAINS.WORLD,
  //   AnchorStateRegistry: '0xD4D7A57DCC563756DeD99e224E144A6Bf0327099',
  //   GameFinder: FINDER_MAINNET,
  // };

  // https://storage.googleapis.com/cel2-rollup-files/celo/deployment-l1.json
  static readonly celoMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.CELO,
    AnchorStateRegistry: '0x9F18D91949731E766f294A14027bBFE8F28328CC',
    GameFinder: FINDER_MAINNET,
  };
  // https://storage.googleapis.com/cel2-rollup-files/celo-sepolia/deployment-l1.json
  static readonly celoSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.CELO_SEPOLIA,
    AnchorStateRegistry: '0xD73BA8168A61F3E917F0930D5C0401aA47e269D6',
    GameFinder: FINDER_SEPOLIA,
  };

  // https://nft.docs.zora.co/zora-network/intro
  static readonly zoraMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.ZORA,
    AnchorStateRegistry: '0x54027b388330415a34b2dBa9E6d25895649eEFf1',
    GameFinder: FINDER_MAINNET,
  };

  // 20240917: delayed constructor not needed
  readonly AnchorStateRegistry: Contract;
  readonly GameFinder: Contract;
  public gameTypes: bigint[] = [];
  public allowedProposers: HexAddress[] = [];
  unfinalizedRootClaimTimeoutMs = 15000;
  constructor(
    providers: ProviderPair,
    config: OPFaultConfig,
    public minAgeSec = 0
  ) {
    super(providers);
    this.AnchorStateRegistry = new Contract(
      config.AnchorStateRegistry,
      ANCHOR_STATE_REGISTRY_ABI,
      this.provider1
    );
    this.GameFinder = new Contract(
      config.GameFinder,
      FINDER_ABI,
      this.provider1
    );
  }

  override get unfinalized() {
    return !!this.minAgeSec; // nonzero => unfinalized
  }

  get paramTuple(): OPFaultParamTuple {
    return [
      this.AnchorStateRegistry.target as HexAddress,
      BigInt(this.minAgeSec),
      this.gameTypes,
      this.allowedProposers,
    ];
  }

  async getGameTypes(): Promise<bigint[]> {
    return this.gameTypes.length
      ? this.gameTypes
      : [await this.fetchRespectedGameType()];
  }

  async fetchRespectedGameType(): Promise<bigint> {
    return this.AnchorStateRegistry.respectedGameType({
      blockTag: this.latestBlockTag,
    });
  }

  private async _ensureRootClaim(index: bigint) {
    // dodge canary by requiring a valid root claim
    // finalized claims are assumed valid
    if (this.unfinalized) {
      const timeout = Date.now() + this.unfinalizedRootClaimTimeoutMs; // prevent "infinite" loop
      for (;;) {
        try {
          await this.fetchCommit(index);
          break;
        } catch (err) {
          // NOTE: this could fail for a variety of reasons
          // so we can't just catch "invalid root claim"
          // canary often has invalid block <== likely triggers first
          // canary has invalid time
          // canary has invalid root claim
          // 20250503: this can infinite loop when the rpc errors suck
          if (isEthersError(err)) throw err;
          if (Date.now() > timeout) {
            throw new Error(`timeout _ensureRootClaim()`);
          }
          index = await this.GameFinder.findGameIndex(this.paramTuple, index);
        }
      }
    }
    return index;
  }

  override async fetchLatestCommitIndex(): Promise<bigint> {
    // the primary assumption is that the anchor root is the finalized state
    // however, this is strangely conditional on the gameType
    // (apparently because the anchor state registry is *not* intended for finalization)
    // after a gameType switch, the finalized state "rewinds" to the latest game of the new type
    // to solve this, we use the latest finalized game of *any* supported gameType
    // 20240820: correctly handles the aug 16 respectedGameType change
    // this should be simplified in the future once there is a better policy
    // 20240822: once again uses a helper contract to reduce rpc burden
    return this._ensureRootClaim(
      await this.GameFinder.findGameIndex(
        this.paramTuple,
        0, // most recent game
        { blockTag: this.latestBlockTag }
      )
    );
  }

  protected override async _fetchParentCommitIndex(
    commit: OPFaultCommit
  ): Promise<bigint> {
    return this._ensureRootClaim(
      await this.GameFinder.findGameIndex(this.paramTuple, commit.index)
    );
  }

  protected override async _fetchCommit(index: bigint) {
    const game: ABIFoundGame = (
      await this.GameFinder.gameAtIndex(this.paramTuple, index)
    ).toObject();
    if (!game.l2BlockNumber) throw new Error('invalid game');
    const commit = await this.createCommit(index, game.l2BlockNumber);
    if (this.unfinalized) {
      const gameProxy = new Contract(game.gameProxy, GAME_ABI, this.provider1);
      const expected: HexString32 = await gameProxy.rootClaim();
      const computed = hashOutputRootProof(commit);
      if (expected !== computed) throw new Error(`invalid root claim`);
    }
    return { ...commit, game };
  }

  override async isCommitStillValid(commit: OPFaultCommit): Promise<boolean> {
    const game: ABIFoundGame = await this.GameFinder.gameAtIndex(
      this.paramTuple,
      commit.index
    );
    return !!game.l2BlockNumber;
  }

  override windowFromSec(sec: number): number {
    // finalization time is on-chain
    // https://github.com/ethereum-optimism/optimism/blob/a81de910dc2fd9b2f67ee946466f2de70d62611a/packages/contracts-bedrock/src/dispute/FaultDisputeGame.sol#L590
    return sec;
  }
}
