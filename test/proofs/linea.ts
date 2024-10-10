import { LineaRollup } from '../../src/linea/LineaRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = LineaRollup.mainnetConfig;
const rollup = new LineaRollup(createProviderPair(USER_CONFIG, config), config);

rollup.provider2.on('debug', (e) => {
  if (e.action === 'sendRpcPayload') {
    console.log(JSON.stringify(e.payload));
  }
});

const commit = await rollup.fetchLatestCommit();

// https://lineascan.build/address/0x48F5931C5Dbc2cD9218ba085ce87740157326F59#code
const A = '0x48F5931C5Dbc2cD9218ba085ce87740157326F59';

const p1 = commit.prover.getProofs(A, [2n, 3n]);
const p2 = commit.prover.getProofs(A, [3n, 4n]);
const p3 = commit.prover.getProofs(A, [1n, 4n]);

console.log(await Promise.all([p1, p2, p3]));

console.log(commit.prover.proofMap());

console.log(await commit.prover.getStorage(A, 1n));
console.log(await commit.prover.getStorage(A, 2n));
console.log(await commit.prover.getStorage(A, 3n));
console.log(await commit.prover.getStorage(A, 4n));
