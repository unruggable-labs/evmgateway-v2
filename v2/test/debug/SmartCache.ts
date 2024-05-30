import { SmartCache } from '../src/SmartCache.js';

// TODO: fix me

const cache = new SmartCache<string, number>();

console.log(
  await cache.get('chonk', () => {
    return new Promise((f) => {
      setTimeout(() => f(50), 1000);
    });
  })
);

console.log(
  await cache.get('chonk', () => {
    throw 1;
  })
);

console.log(cache);
