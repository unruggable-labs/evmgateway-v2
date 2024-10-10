import { Foundry } from '@adraffy/blocksmith';
import { LineaRollup } from '../../src/linea/LineaRollup.js';
import { UnfinalizedLineaRollup } from '../../src/linea/UnfinalizedLineaRollup.js';
import { createProviderPair, providerURL } from '../../src/providers.js';
import { ABI_CODER } from '../../src/utils.js';
import { GatewayRequest } from '../../src/vm.js';
import { USER_CONFIG } from '../../src/environment.js';

const config = LineaRollup.mainnetConfig;
const rollup = new UnfinalizedLineaRollup(
  createProviderPair(USER_CONFIG, config),
  config,
  (86400 * 2) / 12
);

const commit = await rollup.fetchLatestCommit();

console.log(commit);

const foundry = await Foundry.launch({
	fork: providerURL(USER_CONFIG, config.chain1)
});
const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
const hooks = await foundry.deploy({
  file: 'LineaVerifierHooks',
  libs: {
    SparseMerkleProof: config.SparseMerkleProof,
  },
});
const verifier = await foundry.deploy({
  file: 'UnfinalizedLineaVerifier',
  args: [[], rollup.defaultWindow, hooks, config.L1MessageService],
  libs: { GatewayVM },
});

const req = new GatewayRequest(1).setTarget('0x48F5931C5Dbc2cD9218ba085ce87740157326F59').read().setOutput(0);
const vm = await commit.prover.evalRequest(req);
const proofSeq = await commit.prover.prove(vm.needs);

console.log(commit.abiEncodedTuple);

const answer = await verifier.getStorageValues(
	'0x', //ABI_CODER.encode(['uint256'], [commit.index]),
	req.toTuple(),
	rollup.encodeWitness(commit, proofSeq)
);

console.log(answer);

await foundry.shutdown();