import { test } from 'bun:test';

function wait(ms: number): Promise<void> {
  return new Promise((f) => setTimeout(f, ms));
}

await (async () => {
  await wait(1000);
  test('1', async (done) => done());
  await wait(1000);
  test('2', () => {});
  await wait(1000);
  test('3', async () => {
    await wait(1000);
  });
})();
