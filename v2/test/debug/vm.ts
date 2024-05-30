import { EVMProver, EVMRequest } from '../../src/vm.js';
//import {Foundry} from '@adraffy/blocksmith';
//import {ethers} from 'ethers';
import { CHAIN_MAINNET, createProvider } from '../providers.js';

// this is just a worksheet

//let foundry = await Foundry.launch({infoLog: false});

const prover = await EVMProver.latest(createProvider(CHAIN_MAINNET));

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

// #0: mapping (bytes32 => Record) records; => struct Record { address owner; address resolver;	uint64 ttl; }
// #1: mapping (address => mapping(address => bool)) operators;
// #2: ENS _old

const output = await prover.createOutput(ENS_REGISTRY, 2n, 0);
console.log(output);
console.log(await EVMProver.resolved([output])); // 0x314159265dD8dbb310642f98f50C066173C1259b

{
  const r = new EVMRequest();
  r.push(ENS_REGISTRY);
  r.target();
  r.push(0);
  r.follow();
  r.collect(0); // owner of root: 0xaB528d626EC275E3faD363fF1393A41F581c5897
  console.log(await prover.execute(r));
}

console.log(
  await prover.execute(
    new EVMRequest().setTarget(ENS_REGISTRY).element(0).getValue()
  )
);

console.log(
  await prover.execute(
    new EVMRequest()
      .setTarget('0xE68d1aEeE2C17E43A955103DaB5E341eE439f55c')
      .getValues(10)
  )
);

prover.provider.destroy();
//await foundry.shutdown();
