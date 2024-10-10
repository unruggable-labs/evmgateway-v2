// https://github.com/ethereum-optimism/specs/blob/main/specs/protocol/deposits.md

import { ethers } from 'ethers';
import { CHAINS } from '../../../src/chains.js';
import { createProvider } from '../../../src/providers.js';
import { ABI_CODER } from '../../../src/utils.js';
import { HexString } from '@resolverworks/ezccip';

const provider1 = createProvider(CHAINS.MAINNET);
const provider2 = createProvider(CHAINS.OP);

const L1Block = new ethers.Contract(
  '0x4200000000000000000000000000000000000015',
  ['function number() view returns (uint256)'],
  provider2
);
console.log(L1Block);

const SystemConfig = new ethers.Contract(
  '0x229047fed2591dbec1eF1118d64F7aF3dB9EB290',
  ['function batcherHash() view returns (bytes32)'],
  provider1
);
const batcherHash = await SystemConfig.batcherHash();
// console.log({batcherHash});
// 0x0000000000000000000000006887246668a3b87f54deb3b94ba47a6f63f32985

//const l1BlockNumber = await L1Block.number();
const l1BlockNumber = 0x13c22e3;

console.log(l1BlockNumber);

// MethodID: 0x440a5e20
// 0000146b
// 000f79c5
// 0000000000000002
// 0000000066dfe167
// 00000000013c22e3
// [1]:  000000000000000000000000000000000000000000000000000000005f396045
// [2]:  0000000000000000000000000000000000000000000000000000000000000001
// [3]:  d8f811f0ab6a3aabb02dd1bb593e427fdf98b10714b013b01ae70cd1c832a38b
// [4]:  0000000000000000000000006887246668a3b87f54deb3b94ba47a6f63f32985

const txHash =
  '0x069f6141dc1341d66dbefe08a057ff90474e6a9ceec56359cf39fa158a711d01';
// const tx = await provider2.getTransaction(txHash);

// if (!tx) throw 1;

// const l1BlockInfo = await provider1.send('eth_getBlockByNumber', [
//   toString16(l1BlockNumber),
//   false,
// ]);

// console.log(l1BlockInfo);

const tx = {
  data: '0x440a5e200000146b000f79c500000000000000020000000066dfe16700000000013c22e3000000000000000000000000000000000000000000000000000000005f3960450000000000000000000000000000000000000000000000000000000000000001d8f811f0ab6a3aabb02dd1bb593e427fdf98b10714b013b01ae70cd1c832a38b0000000000000000000000006887246668a3b87f54deb3b94ba47a6f63f32985',
};

const l1BlockInfo = {
  hash: '0xd8f811f0ab6a3aabb02dd1bb593e427fdf98b10714b013b01ae70cd1c832a38b',
  timestamp: '0x66dfe167',
  number: '0x13c22e3',
  baseFeePerGas: '0x5f396045',
};

// function pr(x: HexString): HexString {
//   console.log(x);
//   return x;
// }

const baseFeeScalar = 0x0000146b;
const blobBaseFeeScalar = 0x000f79c5;

const calldata = ABI_CODER.encode(
  [
    'bytes4',
    'uint32',
    'uint32',
    'uint64',
    'uint64',
    'uint64',
    'uint256',
    'uint256',
    'bytes32',
    'bytes32',
  ],
  [
    '0x440a5e20',
    baseFeeScalar,
    blobBaseFeeScalar,
    2, // sequence number
    l1BlockInfo.timestamp,
    l1BlockInfo.number,
    l1BlockInfo.baseFeePerGas,
    1, // blobFeePerGas
    l1BlockInfo.hash,
    batcherHash,
  ]
);
//console.log(calldata);

/*
https://github.com/ethereum-optimism/optimism/blob/d887cfa990a39b30bb102e480661a1f09e0add67/op-node/rollup/derive/deposit_source.go#L38

bytes32 sourceHash: the source-hash, uniquely identifies the origin of the deposit.
address from: The address of the sender account.
address to: The address of the recipient account, or the null (zero-length) address if the deposited transaction is a contract creation.
uint256 mint: The ETH value to mint on L2.
uint256 value: The ETH value to send to the recipient account.
uint64 gas: The gas limit for the L2 transaction.
bool isSystemTx: If true, the transaction does not interact with the L2 block gas pool.
	Note: boolean is disabled (enforced to be false) starting from the Regolith upgrade.
bytes data: The calldata.
*/
const domain = 1;
const sequenceDelta = 0;
// sourceHash = keccak256(bytes32(uint256(1)), keccak256(l1BlockHash, bytes32(uint256(seqNumber))))
const sourceHash = ethers.keccak256(
  ABI_CODER.encode(
    ['uint256', 'bytes32'],
    [
      domain,
      ethers.keccak256(
        ABI_CODER.encode(
          ['bytes32', 'uint256'],
          [l1BlockInfo.hash, sequenceDelta]
        )
      ),
    ]
  )
);
const from = '0xDeaDDEaDDeAdDeAdDEAdDEaddeAddEAdDEAd0001';
const to = '0x4200000000000000000000000000000000000015';

function rlp(data: HexString) {
  return ethers.encodeRlp([
    sourceHash,
    from,
    to,
    [], // mint = 0
    [], // value = 0
    ethers.toBeArray(1_000_000), // gas = 1m
    [], // false
    data,
  ]);
}

console.log(txHash);
console.log(ethers.keccak256(rlp(tx.data)));
console.log(ethers.keccak256(ethers.concat(['0x7E', rlp(tx.data)])));
console.log(ethers.keccak256(rlp(calldata)));
console.log(ethers.keccak256(ethers.concat(['0x7E', rlp(calldata)])));

// const b = await provider2.getBlock(125174731);
// //console.log(b);
// if (!b) throw 1;

// console.log(b);

// console.log(await provider2.call({
// 	to: '0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02',
// 	data: toPaddedHex(b.timestamp)
// }));

// console.log(b.parentBeaconBlockRoot);

// for (let i = 20718308; i >= 0; i--) {
// 	const b1 = await provider1.getBlock(i);
// 	if (!b1) continue;
// 	console.log(i, b1.parentBeaconBlockRoot, b1.parentBeaconBlockRoot == b.parentBeaconBlockRoot);

// }
