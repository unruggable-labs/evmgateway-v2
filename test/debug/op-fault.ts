import { Foundry } from '@adraffy/blocksmith';
import { CHAINS } from '../../src/chains.js';
import { type OPFaultParamTuple, OPFaultRollup } from '../../src/op/OPFaultRollup.js';
import { providerURL } from '../providers.js';

const foundry = await Foundry.launch({
  infoLog: true,
  fork: providerURL(CHAINS.MAINNET),
});

const OPFaultGameFinder = await foundry.deploy({ file: 'OPFaultGameFinder' });

const paramTuple: OPFaultParamTuple = [
  OPFaultRollup.baseMainnetConfig.AnchorStateRegistry,
  21600n,
  [],
  [],
];

const index = await OPFaultGameFinder.findGameIndex(paramTuple, 0);

console.log({ index });

console.log(await OPFaultGameFinder.gameAtIndex(paramTuple, index));

await foundry.shutdown();
