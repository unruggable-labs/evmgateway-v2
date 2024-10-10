import * as fs from 'fs';
import * as path from 'path';
import { CHAINS_NAMES } from './chains.js';

const args: { [key: string]: string } = {};
process.argv.slice(2).forEach((arg) => {
  const [key, value] = arg.split('=');
  args[key.replace(/^--/, '')] = value;
});

const ENV_FILE_NAME = args['config'] || '.env';

// Get the path to the .env file
const envFilePath = path.resolve(process.cwd(), ENV_FILE_NAME);

// Read the contents of the .env file
const envFileContent = fs.readFileSync(envFilePath, 'utf-8');

// Parse the .env file contents to get only the variables defined in the file
export const USER_CONFIG = envFileContent
  .split('\n')
  .filter((line: string) => line.trim() && !line.startsWith('#')) // Remove empty lines and comments
  .reduce((acc: any, line: any) => {
    const [key, value] = line.split('=');
    acc[key.trim()] = value.trim();
    return acc;
  }, {});

export const testConfig = (chainName: string) => {
  if (![...CHAINS_NAMES.values()].includes(chainName)) {
    throw new TypeError(`unknown chain name: ${chainName}`);
  }
  USER_CONFIG['CHAIN_NAME'] = chainName;
  return USER_CONFIG;
};
