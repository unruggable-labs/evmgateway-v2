import { CHAINS } from '../../src/chains.js';
import { EthProver } from '../../src/eth/EthProver.js';
import { createProvider } from '../../src/providers.js';

const prover = await EthProver.latest(createProvider(CHAINS.MAINNET));

// console.log(
//   await prover.getProofs('0x51050ec063d393217B436747617aD1C2285Aeeee', [1n, 2n])
// );

const A = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

prover.provider.on('debug', (e) => {
  if (e.action === 'sendRpcPayload') {
    console.log(e.payload);
  }
});

//console.log(await prover.isContract(A));

//console.log(await prover.getStorage(A, 1n));

await prover.getProofs(A, [1n, 2n]);

//prover.provider.on('debug', e => console.log(e));

const p1 = prover.getProofs(A, [2n, 3n]);
const p2 = prover.getProofs(A, [3n, 4n]);
const p3 = prover.getProofs(A, [1n, 4n]);
await Promise.all([p1, p2, p3]);

console.log(prover.proofMap());

console.log(await prover.getStorage(A, 1n));
console.log(await prover.getStorage(A, 2n));
console.log(await prover.getStorage(A.toUpperCase(), 3n));
console.log(await prover.getStorage(A.toLowerCase(), 4n));

//let p0 = await prover.fetchProofs2(A, [1n, 2n]);
//let p1 = await prover.fetchProofs(A, [1n, 2n]);

//console.log(Bun.deepEquals(p0, p1));

//console.log(await prover.isContract(A));
//console.log(await prover.isContract('0x51050ec063d393217B436747617aD1C2285Aeeee'));

//console.log(await prover.fetchProofs(A, [1n]));
