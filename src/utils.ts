import { AbiCoder } from 'ethers/abi';
import { makeError } from 'ethers/utils';
import { id as keccakStr } from 'ethers/hash';
import { type JsonRpcPayload, JsonRpcProvider } from 'ethers/providers';
import type { Provider, BigNumberish, HexString } from './types.js';
import type { RPCEthGetBlock } from './eth/types.js';

export const ABI_CODER = AbiCoder.defaultAbiCoder();

// https://adraffy.github.io/keccak.js/test/demo.html#algo=keccak-256&s=&escape=1&encoding=utf8
// "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
export const NULL_CODE_HASH = keccakStr('');

export const EVM_BLOCKHASH_DEPTH = 256;

export const MAINNET_BLOCK_SEC = 12;

// hex-prefixed w/o zero-padding
export function toUnpaddedHex(x: BigNumberish | boolean): HexString {
  return '0x' + BigInt(x).toString(16);
}
// hex-prefixed left-pad w/truncation
export function toPaddedHex(x: BigNumberish | boolean, width = 32) {
  const i = x === '0x' ? 0n : BigInt.asUintN(width << 3, BigInt(x));
  return '0x' + i.toString(16).padStart(width << 1, '0');
}

// manual polyfill: ES2024
export function withResolvers<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((ful, rej) => {
    resolve = ful;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function sendRetry<T>(
  provider: Provider,
  method: string,
  params: any[],
  retryCount: number
): Promise<T> {
  for (;;) {
    try {
      return await provider.send(method, params);
    } catch (err) {
      if (
        retryCount > 0 &&
        err instanceof Error &&
        'shortMessage' in err &&
        err.shortMessage === 'could not coalesce error'
      ) {
        // 20240829: workaround for bad polygon rpcs
        //console.log(`Retries remaining: ${retryCount}`);
        --retryCount;
        continue;
      }
      throw err;
    }
  }
}

export async function sendImmediate<T>(
  provider: Provider,
  method: string,
  params: any[]
): Promise<T> {
  if (
    !(provider instanceof JsonRpcProvider) ||
    provider._getOption('batchMaxCount') == 1
  ) {
    return provider.send(method, params);
  }
  //const id = ((Math.random() * 0x7fffffff) | 0x80000000) >>> 0;
  const id = 1; // since this is fetch-based, it's okay to reuse id
  const payload: JsonRpcPayload = {
    method,
    params,
    id,
    jsonrpc: '2.0',
  };
  // attempt to emulate what ethers does
  // https://github.com/ethers-io/ethers.js/blob/main/lib.esm/providers/provider-jsonrpc.js
  provider.emit('debug', { action: 'sendRpcPayload', payload });
  let resp;
  try {
    const result = await provider._send(payload);
    provider.emit('debug', { action: 'receiveRpcResult', result });
    resp = result.find((x) => x.id === id);
    if (!resp) {
      const error = makeError('missing response for request', 'BAD_DATA', {
        value: result,
        info: { payload },
      });
      provider.emit('error', error);
      throw error;
    }
  } catch (error) {
    provider.emit('debug', { action: 'receiveRpcError', error });
    throw error;
  }
  if ('result' in resp) {
    return resp.result;
  } else {
    throw provider.getRpcError(payload, resp);
  }
}

export async function fetchBlock(provider: Provider, block: BigNumberish) {
  const json: RPCEthGetBlock | null = await provider.send(
    'eth_getBlockByNumber',
    [typeof block === 'string' ? block : toUnpaddedHex(block), false]
  );
  if (!json) throw new Error(`no block: ${block}`);
  return json;
}
