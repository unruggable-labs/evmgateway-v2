import { CHAINS } from '../../src/chains.js';
import { toPaddedHex } from '../../src/utils.js';
import { createProvider } from '../providers.js';

/*
import { ZKEVMProver } from '../../src/polygon/ZKEVMProver.js';
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider('https://rpc.ankr.com/polygon_zkevm', CHAINS.ZKEVM, {staticNetwork: true});
const prover = await ZKEVMProver.latest(provider);

console.log(await provider.send('web3_clientVersion', []));

//console.log(await prover.fetchBlock());

console.log(await prover.getProofs('0x5132A183E9F3CB7C848b0AAC5Ae0c4f0491B7aB2'));
*/

const p = createProvider(CHAINS.ZKEVM_CARDONA);

console.log(
  await p.send('eth_getProof', [
    '0x32d33D5137a7cFFb54c5Bf8371172bcEc5f310ff',
    [toPaddedHex(0)],
    'latest',
  ])
);
