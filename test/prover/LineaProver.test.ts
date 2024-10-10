import { Foundry } from '@adraffy/blocksmith';
import { createProviderPair, providerURL } from '../../src/providers.js';
import { LineaRollup } from '../../src/linea/LineaRollup.js';
import { ZeroHash } from 'ethers/constants';
import { test, expect, afterAll } from 'bun:test';
import { toPaddedHex } from '../../src/utils.js';
import { describe } from '../bun-describe-fix.js';
import { USER_CONFIG } from '../../src/environment.js';

describe('LineaProver', async () => {
  const config = LineaRollup.mainnetConfig;
  const gateway = new LineaRollup(
    createProviderPair(USER_CONFIG, config),
    config
  );
  const commit = await gateway.fetchLatestCommit();
  const foundry = await Foundry.launch({
    fork: providerURL(USER_CONFIG, config.chain1),
    infoLog: false,
  });
  afterAll(() => foundry.shutdown());

  const verifier = await foundry.deploy({
    file: 'LineaVerifierHooks',
    libs: {
      SparseMerkleProof: config.SparseMerkleProof,
    },
  });

  test('dne', async () => {
    const target = '0x0000000000000000000000000000000000001234';
    expect(await commit.prover.isContract(target)).toBeFalse();
    const proof = await commit.prover.prove([{ target, required: true }]);
    const storageRoot = await verifier.verifyAccountState(
      commit.stateRoot,
      target,
      proof.proofs[0]
    );
    expect(storageRoot).toStrictEqual(ZeroHash);
  });

  test('eoa', async () => {
    const target = '0x51050ec063d393217B436747617aD1C2285Aeeee';
    expect(await commit.prover.isContract(target)).toBeFalse();
    const proof = await commit.prover.prove([{ target, required: true }]);
    const storageRoot = await verifier.verifyAccountState(
      commit.stateRoot,
      target,
      proof.proofs[0]
    );
    expect(storageRoot).toStrictEqual(ZeroHash);
  });

  test('contract', async () => {
    const target = '0x48F5931C5Dbc2cD9218ba085ce87740157326F59'; // SlotDataReader
    expect(await commit.prover.isContract(target)).toBeTrue();
    const proof = await commit.prover.prove([{ target, required: true }, 0n]);
    const storageRoot = await verifier.verifyAccountState(
      commit.stateRoot,
      target,
      proof.proofs[0]
    );
    expect(storageRoot).not.toStrictEqual(ZeroHash);
    const storageValue = await verifier.verifyStorageValue(
      storageRoot,
      target,
      0n,
      proof.proofs[1]
    );
    expect(storageValue).toStrictEqual(toPaddedHex(49));
  });
});
