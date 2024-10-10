import type { Chain } from './types.js';

// https://chainlist.wtf
// https://www.superchain.eco/chains

export const CHAINS = {
  MAINNET: 1n,
  SEPOLIA: 11155111n,
  HOLESKY: 17000n,
  OP: 10n,
  OP_SEPOLIA: 11155420n,
  ZKSYNC: 324n,
  ZKSYNC_SEPOLIA: 300n,
  BASE: 8453n,
  BASE_SEPOLIA: 84532n,
  ARB1: 42161n,
  ARB_NOVA: 42170n,
  ARB_SEPOLIA: 421614n,
  TAIKO: 167000n,
  TAIKO_HEKLA: 167009n,
  SCROLL: 534352n,
  SCROLL_SEPOLIA: 534351n,
  ZKEVM: 1101n,
  ZKEVM_CARDONA: 2442n,
  POLYGON_POS: 137n,
  POLYGON_AMOY: 80002n,
  LINEA: 59144n,
  LINEA_SEPOLIA: 59141n,
  FRAXTAL: 252n,
  ZORA: 7777777n,
  BLAST: 81457n,
  MANTLE: 5000n,
  MANTLE_SEPOLIA: 5001n,
  MODE: 34443n,
  MODE_SEPOLIA: 919n,
  CYBER: 7560n,
  CYBER_SEPOLIA: 111557560n,
  REDSTONE: 690n,
  // GNOSIS: 100n, // L1: must verify against withdrawal signatures?
  SHAPE: 360n,
  BSC: 56n,
  OP_BNB: 204n,
  CELO_ALFAJORES: 44787n,
} as const satisfies Record<string, Chain>;

export const CHAINS_NAMES = new Map<Chain, string>(
  Object.entries(CHAINS).map(([a, b]) => [b, a])
);

export function chainName(chain: Chain): string {
  const name = CHAINS_NAMES.get(chain);
  if (!name) throw new TypeError(`unknown chain: ${chain}`);
  return name;
}
