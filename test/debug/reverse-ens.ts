import type { HexAddress } from '../../src/types.js';
import { createProvider } from '../providers.js';
import { GatewayProgram, GatewayRequest } from '../../src/vm.js';
import { EthProver } from '../../src/eth/EthProver.js';
import { dataSlice, toUtf8String } from 'ethers/utils';
import { namehash } from 'ethers/hash';

const prover = await EthProver.latest(createProvider(1n));

async function primary(address: HexAddress) {
	const name = `${address.slice(2).toLowerCase()}.addr.reverse`;
	const req = new GatewayRequest(2);
	req.push(namehash(name));
	// old ens
	req.setTarget('0x314159265dD8dbb310642f98f50C066173C1259b');
	req.pushStack(0).addSlot().read();
	// current ens
	req.setTarget('0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e');
	req.setSlot(0).pushStack(0).follow();
	req.offset(1).read();
	// pick resolver
	req.pushProgram(new GatewayProgram().requireNonzero().setOutput(0));
	req.evalLoop({success: true, count: 2});
	// target resolver
	req.pushOutput(0).target().requireContract();
	// ideally we would use an ESP here, conditional on the target
	// https://etherscan.io/address/0x5fBb459C49BB06083C33109fA4f14810eC2Cf358
	// https://etherscan.io/address/0xA2C122BE93b0074270ebeE7f6b7292C7deB45047#code
	req.setSlot(1).pushStack(0).follow().readBytes();
	// https://etherscan.io/address/0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63
	req.setSlot(1).pushStack(0).follow().read();
   	req.setSlot(8).follow().pushStack(0).follow().readBytes();
	// pick name()
	req.pushProgram(new GatewayProgram().requireNonzero().setOutput(1));
	req.evalLoop({success: true, count: 2});
	console.log(req.encode());
	const state = await prover.evalRequest(req);
	const values = await state.resolveOutputs();
	console.log({
		address,
		resolver: dataSlice(values[0], 12, 32),
		name: toUtf8String(values[1])
	});
}

await primary('0x51050ec063d393217B436747617aD1C2285Aeeee'); // 0x231b
await primary('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); // 0x5fbb
await primary('0xAC50cE326de14dDF9b7e9611Cd2F33a1Af8aC039'); // 0xa2c1
await primary('0x8b1f85a93Ac6E4F62695Ea8EF2410d248605FEff'); // 0xa2c1
