import type { BytesLike, HexString } from '../src/types.js';
import { ethers } from 'ethers';

// convenience to decode a single ABI type
export function decodeType(type: string, data: BytesLike) {
  return ethers.AbiCoder.defaultAbiCoder().decode([type], data)[0];
}

// function packedElementSize(type: string): [step: number, int: boolean] {
// 	switch (type) {
// 		case 'bool': return [1, true];
// 		case 'address': return [20, false];
// 	}
// 	let match = type.match(/^(u?int|bytes)([0-9]*)$/);
// 	if (!match) throw new Error(`unsized type: ${type}`);
// 	let int = match[1] !== 'bytes';
// 	let scale = int ? 8 : 1;
// 	let value = parseInt(match[2] || '256');
// 	let size = value / scale;
// 	if (!Number.isInteger(size) || size < 1 || size > 32) throw new Error(`expected 1-32 bytes: ${type}`);
// 	return [size, int];
// }

export function decodeStorageArray(step: number, data: BytesLike): HexString[] {
  if (!Number.isInteger(step) || step < 1 || step > 32)
    throw new Error(`invalid step: ${step}`);
  const v = ethers.getBytes(data);
  const n = Number(ethers.toBigInt(v.subarray(0, 32)));
  const per = (32 / step) | 0;
  return Array.from({ length: n }, (_, i) => {
    const x = 64 + ((i / per) << 5) - (i % per) * step;
    return ethers.hexlify(v.subarray(x - step, x));
  });
}
