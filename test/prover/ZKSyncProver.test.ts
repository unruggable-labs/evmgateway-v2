import { Foundry } from '@adraffy/blocksmith';
import { createProviderPair, providerURL } from '../../src/providers.js';
import { ZKSyncRollup } from '../../src/zksync/ZKSyncRollup.js';
import { test, expect, afterAll } from 'bun:test';
import { toPaddedHex } from '../../src/utils.js';
import { describe } from '../bun-describe-fix.js';
import { ZeroHash } from 'ethers/constants';
import { USER_CONFIG } from '../../src/environment.js';

describe('ZKSyncProver', async () => {
  const config = ZKSyncRollup.mainnetConfig;
  const rollup = new ZKSyncRollup(
    createProviderPair(USER_CONFIG, config),
    config
  );
  const commit = await rollup.fetchLatestCommit();
  const foundry = await Foundry.launch({
    fork: providerURL(USER_CONFIG, config.chain1),
    infoLog: false,
  });
  afterAll(() => foundry.shutdown());

  const ZKSyncSMT = await foundry.deploy({ file: 'ZKSyncSMT' });
  const verifier = await foundry.deploy({
    file: 'ZKSyncVerifierHooks',
    args: [ZKSyncSMT],
  });

  test('unused account is null', async () => {
    const target = '0x0000000000000000000000000000000000001234';
    const proof = await commit.prover.prove([{ target, required: false }]);
    expect(proof.proofs).toStrictEqual(['0x']);
  });

  test('dne', async () => {
    const target = '0x0000000000000000000000000000000000001234';
    expect(commit.prover.isContract(target)).resolves.toBeFalse();
    const proof = await commit.prover.prove([{ target, required: true }]);
    const stateRoot = await verifier.verifyAccountState(
      commit.stateRoot,
      target,
      proof.proofs[0]
    );
    expect(stateRoot).toStrictEqual(ZeroHash);
  });

  test('eoa', async () => {
    const target = '0x51050ec063d393217B436747617aD1C2285Aeeee';
    expect(commit.prover.isContract(target)).resolves.toBeFalse();
    const proof = await commit.prover.prove([{ target, required: true }]);
    const stateRoot = await verifier.verifyAccountState(
      commit.stateRoot,
      target,
      proof.proofs[0]
    );
    expect(stateRoot).toStrictEqual(ZeroHash);
  });

  test('contract', async () => {
    const target = '0x1Cd42904e173EA9f7BA05BbB685882Ea46969dEc'; // SlotDataReader
    expect(commit.prover.isContract(target)).resolves.toBeTrue();
    const proof = await commit.prover.prove([{ target, required: true }, 0n]);
    const stateRoot = await verifier.verifyAccountState(
      commit.stateRoot,
      target,
      proof.proofs[0]
    );
    expect(stateRoot).toStrictEqual(commit.stateRoot);
    const storageValue = await verifier.verifyStorageValue(
      stateRoot,
      target,
      0n,
      proof.proofs[1]
    );
    expect(storageValue).toStrictEqual(toPaddedHex(49));
  });
});
