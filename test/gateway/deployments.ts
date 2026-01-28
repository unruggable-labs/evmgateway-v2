import type { HexAddress } from '../../src/types.js';
import { CHAINS } from '../../src/chains.js';
import json from '../../deployments/testing.json' with { type: 'json' };

export type TestDeployments = {
  slotDataContract: HexAddress;
  slotDataPointer?: HexAddress;
};

export const DEPLOYMENTS = json as Record<keyof typeof CHAINS, TestDeployments>;
