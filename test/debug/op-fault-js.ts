import { Contract } from 'ethers';
import { CHAINS } from '../../src/chains.js';
import { OPFaultRollup } from '../../src/op/OPFaultRollup.js';
import { createProviderPair } from '../providers.js';

const rollup = new OPFaultRollup(createProviderPair(CHAINS.BASE), OPFaultRollup.baseMainnetConfig);

const DisputeGameFactory = new Contract(
  await rollup.AnchorStateRegistry.disputeGameFactory(),
  OPFaultRollup.DISPUTE_GAME_FACTORY_ABI,
  rollup.provider1,
);

const gameCount = await DisputeGameFactory.gameCount();

console.log({
    GameFinder: rollup.GameFinder.target,
    AnchorStateRegistry: rollup.AnchorStateRegistry.target,
    DisputeGameFactory: DisputeGameFactory.target,
    gameCount
});

console.log(await rollup.GameFinder.gameAtIndex(rollup.paramTuple, gameCount - 1n));
