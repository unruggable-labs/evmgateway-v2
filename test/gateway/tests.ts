import type { Contract } from 'ethers/contract';
import { expect, test } from 'bun:test';

const opts = { enableCcipRead: true };

// imo better to expect(await) than expect().resolves
export function runSlotDataTests(
  r: Contract,
  pointer = false,
  skipZero = false
) {
  test('latest = 49', async () => {
    expect(await r.readLatest(opts)).toEqual(49n);
  });
  test.skipIf(!pointer)('pointer => latest = 49', async () => {
    expect(await r.readLatestViaPointer(opts)).toEqual(49n);
  });
  test('name = "Satoshi"', async () => {
    expect(await r.readName(opts)).toEqual('Satoshi');
  });
  test('highscores[0] = 1', async () => {
    expect(await r.readHighscore(0, opts)).toEqual(1n);
  });
  test('highscores[latest] = 12345', async () => {
    expect(await r.readLatestHighscore(opts)).toEqual(12345n);
  });
  test('highscorers[latest] = name', async () => {
    expect(await r.readLatestHighscorer(opts)).toEqual('Satoshi');
  });
  test('realnames["Money Skeleton"] = "Vitalik Buterin"', async () => {
    expect(await r.readRealName('Money Skeleton', opts)).toEqual(
      'Vitalik Buterin'
    );
  });
  test('realnames[highscorers[latest]] = "Hal Finney"', async () => {
    expect(await r.readLatestHighscorerRealName(opts)).toEqual('Hal Finney');
  });
  test.skipIf(skipZero)('zero = 0', async () => {
    expect(await r.readZero(opts)).toEqual(0n);
  });
  test('root.str = "raffy"', async () => {
    expect(await r.readRootStr([], opts)).toEqual('raffy');
  });
  test('root.map["a"].str = "chonk"', async () => {
    expect(await r.readRootStr(['a'], opts)).toEqual('chonk');
  });
  test('root.map["a"].map["b"].str = "eth"', async () => {
    expect(await r.readRootStr(['a', 'b'], opts)).toEqual('eth');
  });
  test('highscorers[keccak(...)] = "chonk"', async () => {
    expect(await r.readSlicedKeccak(opts)).toEqual('chonk');
  });
}
