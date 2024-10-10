import { Foundry } from '@adraffy/blocksmith';
import { EthProver } from "../../src/eth/EthProver.js";
import { GatewayProgram, GatewayRequest } from "../../src/vm.js";

const foundry = await Foundry.launch();
const prover = await EthProver.latest(foundry.provider);

const req = new GatewayRequest(1);

req.pushProgram(new GatewayProgram().pushOutput(0).eval());
req.setOutput(0);
req.pushOutput(0);
req.eval();

try {
	await prover.evalRequest(req);
} catch (err) {
	console.log(err);
}

await foundry.shutdown();
