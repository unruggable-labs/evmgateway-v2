import { ZKSyncRollup } from '../../src/zksync/ZKSyncRollup.js';
import { createProviderPair } from '../../src/providers.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = ZKSyncRollup.mainnetConfig;
const rollup = new ZKSyncRollup(
  createProviderPair(USER_CONFIG, config),
  config
);

rollup.provider2.on('debug', (e) => {
  if (e.action === 'sendRpcPayload') {
    console.log(e.payload);
  }
});

const commit = await rollup.fetchLatestCommit();

// https://explorer.zksync.io/address/0x1Cd42904e173EA9f7BA05BbB685882Ea46969dEc#contract
const A = '0x1Cd42904e173EA9f7BA05BbB685882Ea46969dEc';

const p1 = commit.prover.getStorageProofs(A, [2n, 3n]);
const p2 = commit.prover.getStorageProofs(A, [3n, 4n]);
const p3 = commit.prover.getStorageProofs(A, [1n, 4n]);

console.log(await Promise.all([p1, p2, p3]));

console.log(commit.prover.proofMap());

console.log(await commit.prover.getStorage(A, 1n));
console.log(await commit.prover.getStorage(A, 2n));
console.log(await commit.prover.getStorage(A, 3n));
console.log(await commit.prover.getStorage(A, 4n));
