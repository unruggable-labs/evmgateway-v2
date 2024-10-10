import { EthProver } from '../src/eth/EthProver.js';
import { Foundry } from '@adraffy/blocksmith';
import { readFileSync } from 'node:fs';
import { GATEWAY_OP } from '../src/ops.js';
import { expect } from 'bun:test';

const foundry = await Foundry.launch({ infoLog: false });
try {
  const code = readFileSync(
    new URL('../contracts/GatewayRequest.sol', import.meta.url),
    { encoding: 'utf8' }
  );
  const jsMap = new Map<string, number>(Object.entries(GATEWAY_OP));
  const solMap = new Map<string, number>();
  for (const match of code.matchAll(
    /^uint8 constant OP_([0-9A-Z_]+)\s*=\s*(\d+)/gm
  )) {
    solMap.set(match[1], parseInt(match[2]));
  }
  const union = new Set([...solMap.keys(), ...jsMap.keys()]);
  const seen = new Set<number>();
  const prover = await EthProver.latest(foundry.provider);
  for (const name of union) {
    const js = jsMap.get(name);
    const sol = solMap.get(name);
    // check defined the same in js and solc
    expect(js, `js op: ${name}`).toBeNumber();
    expect(sol, `sol op: ${name}`).toEqual(js!);
    expect(seen.has(js!), `dup: ${name}`).toEqual(false);
    seen.add(js!);
    // check for an implementation
    try {
      await prover.evalDecoded(Uint8Array.of(0, js!));
    } catch (err) {
      if (err instanceof Error && /^unknown op: \d+$/.test(err.message)) {
        throw err;
      }
    }
  }
  // check push 0-32
  for (let i = 0; i <= 32; i++) {
    const name = `PUSH_${i}`;
    expect(solMap.get(name), name).toEqual(i);
  }
} finally {
  await foundry.shutdown();
}
