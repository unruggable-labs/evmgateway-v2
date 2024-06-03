import {OPGateway} from '../../src/gateway/OPGateway.js';
import {ethers} from 'ethers';
import {HexString, serve} from '@resolverworks/ezccip';
import {Foundry, Node} from '@adraffy/blocksmith';
import {createProvider, providerURL, CHAIN_BASE} from '../providers.js';

let foundry = await Foundry.launch({
	fork: providerURL(1)
});

let gateway = OPGateway.baseMainnet({
	provider1: foundry.provider,
	provider2: createProvider(CHAIN_BASE)
});

let ccip = await serve(gateway, {protocol: 'raw'});

let verifier = await foundry.deploy({file: 'verifier/OPVerifier', args: [[ccip.endpoint], gateway.L2OutputOracle, 1]});

let root = Node.root();
let ens = await foundry.deploy({import: '@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol'});
Object.assign(ens, {
	async $register(node: Node, options: {owner?: HexString, resolver?: HexString} = {}) {
		let parentNamehash = node.parent['namehash'] as string; // TODO: blocksmith bug
		let w = foundry.requireWallet(await this.owner(parentNamehash)); 
		let owner = foundry.requireWallet(options.owner!, w);
		await foundry.confirm(this.connect(w).setSubnodeRecord(parentNamehash, node.labelhash, owner, options.resolver ?? ethers.ZeroAddress, 0), {name: node.name});
		return node;
	}
});




ccip.http.close();
foundry.shutdown();
