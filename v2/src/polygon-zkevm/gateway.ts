import {
  CHAIN_MAINNET,
  CHAIN_SEPOLIA,
  CHAIN_ZKEVM,
  CHAIN_ZKEVM_CARDONA,
} from '../chains.js';
import type { GatewayConfig } from '../AbstractGateway.js';
import type { HexAddress } from '../types.js';

type Constructor = {
  RollupManager: HexAddress;
};

export class ZKEVMGateway {
  static readonly mainnetConfig: GatewayConfig<Constructor> = {
    chain1: CHAIN_MAINNET,
    chain2: CHAIN_ZKEVM,
    // https://docs.polygon.technology/zkEVM/architecture/high-level/smart-contracts/addresses/#mainnet-contracts
    RollupManager: '0x5132A183E9F3CB7C848b0AAC5Ae0c4f0491B7aB2',
  };
  static readonly testnetConfig: GatewayConfig<Constructor> = {
    chain1: CHAIN_SEPOLIA,
    chain2: CHAIN_ZKEVM_CARDONA,
    // https://github.com/0xPolygonHermez/cdk-erigon/tree/zkevm#networks
    RollupManager: '0x32d33D5137a7cFFb54c5Bf8371172bcEc5f310ff',
  };
}
