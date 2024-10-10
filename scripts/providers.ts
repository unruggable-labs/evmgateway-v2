import type { Chain } from '../src/types.js';
import { CHAINS, chainName } from '../src/chains.js';
import { RPC_INFO, providerURL } from '../src/providers.js';

const usingPublic: Chain[] = [];
const leftover = new Set<Chain>(Object.values(CHAINS));

for (const info of RPC_INFO.values()) {
  leftover.delete(info.chain);
  const url = providerURL(info.chain);
  console.log(
    info.chain.toString().padStart(10),
    chainName(info.chain).padEnd(16),
    `[${info.alchemy ? 'A' : ' '}${info.infura ? 'I' : ' '}${info.ankr ? 'K' : ' '}]`,
    url === info.rpc ? '!' : ' ',
    url
  );
  if (url === info.rpc) {
    usingPublic.push(info.chain);
  }
}

if (usingPublic.length) {
  console.error(`${usingPublic.length} using Public RPC!`);
  console.error(usingPublic.map(chainName));
}

if (leftover.size) {
  console.error(`${leftover.size} missing RPCInfo!`);
  console.error(Array.from(leftover, chainName));
  process.exit(1); // fatal
}
