import { Deployable, FoundryDeployer } from '@adraffy/blocksmith';
import { createProvider, providerURL } from '../test/providers.js';
import { chainFromName, chainName } from '../src/chains.js';
import { isAddress } from 'ethers';

async function prompt(q: string) {
  process.stdout.write(q);
  for await (const line of console) {
    return line.trim();
  }
  return '';
}

const retry = 50; // why is the indexer so slow?

const chain = chainFromName(
  (await prompt(`Chain (name or id, default: 1): `)) || '1'
);
console.log(`Chain: ${chainName(chain)} (${chain}) ${providerURL(chain)}`);

const input = await prompt(
  'Private Key (deploy) or Address (verify) or empty (simulate): '
);

const deployer = await FoundryDeployer.load({
  provider: createProvider(chain),
  privateKey: isAddress(input) ? undefined : input,
});

const deployable = await promptDeployment();
if (deployable) {
  if (isAddress(input)) {
    await promptEtherscan();
    await deployable.verifyEtherscan({ address: input, retry });
  } else if (deployer.privateKey) {
    await prompt('Deploy? (abort to stop) ');
    await deployable.deploy();
    await promptEtherscan();
    if (deployer.etherscanApiKey) {
      await deployable.verifyEtherscan({ retry });
    }
  } else {
    console.log(deployable);
    console.log(deployable.deployArgs().join(' '));
  }
}

async function promptEtherscan() {
  if (!deployer.etherscanApiKey) {
    deployer.etherscanApiKey = await prompt('Etherscan API Key: ');
  }
}

async function promptDeployment(): Promise<Deployable> {
  console.log('1) OPFaultGameFinder');
  console.log('2) EthVerifierHooks');
  switch (await prompt('Deployment: ')) {
    case '1':
      return deployer.prepare({
        file: 'OPFaultGameFinder',
      });
    case '2':
      return deployer.prepare({
        file: 'EthVerifierHooks',
      });
    default:
      throw new Error('unknown deployment');
  }
}
