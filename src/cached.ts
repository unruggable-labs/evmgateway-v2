// CachedMap maintains 2 maps:
// 1) pending promises by key
// 2) settled promises by key + expiration
// requests for the same key return the same promise
// which may be from (1) or (2)
// too many pending {maxPending} are errors
// too many cached {maxCached} purge the oldest
// resolved promises are cached for {cacheMs}
// rejected promises are cached for {errorMs}

// CachedValue does the same for a single value
// using an init-time generator

const ERR = Symbol();

function clock() {
  return performance.now();
}

export class CachedValue<T> {
  #exp: number = 0;
  #value: Promise<T> | undefined;
  errorMs = 250;
  constructor(
    readonly fn: () => Promise<T>,
    public cacheMs: number = 60000
  ) {}
  clear() {
    this.#value = undefined;
  }
  set(value: T) {
    this.#value = Promise.resolve(value);
    this.#exp = clock() + this.cacheMs;
  }
  get value() {
    return this.#value;
  }
  async get() {
    if (this.#value) {
      if (this.#exp > clock()) return this.#value;
      this.#value = undefined;
    }
    const p = (this.#value = this.fn());
    return p
      .catch(() => ERR)
      .then((x) => {
        if (this.#value === p) {
          this.#exp = clock() + (x === ERR ? this.errorMs : this.cacheMs);
        }
        return p;
      });
  }
}

type CacheRow<T> = [exp: number, promise: Promise<T>];

export interface CacheMap<K, V> {
  cache(key: K, fn: (key: K) => Promise<V>): Promise<V>;
}

export class CachedMap<K, V> {
  private readonly cached: Map<K, CacheRow<V>> = new Map();
  private readonly pending: Map<K, Promise<V>> = new Map();
  private timer: Timer | undefined;
  private timer_t: number = Infinity;
  errorMs = 250; // how long to cache a rejected promise
  slopMs = 50; // reschedule precision
  constructor(
    public cacheMs = 60000, // how long to cache a resolved promise
    public maxCached = 10000 // overflow clears oldest items
  ) {}
  private schedule(exp: number) {
    const now = clock();
    const t = Math.max(now + this.slopMs, exp);
    if (this.timer_t < t) return; // scheduled and shorter
    clearTimeout(this.timer); // kill old
    this.timer_t = t; // remember fire time
    if (t === Infinity) return;
    this.timer = setTimeout(() => {
      const now = clock();
      let min = Infinity;
      for (const [key, [exp]] of this.cached) {
        if (exp < now) {
          this.cached.delete(key);
        } else {
          min = Math.min(min, exp); // find next
        }
      }
      this.timer_t = Infinity;
      if (this.cached.size && min < Infinity) {
        this.schedule(min); // schedule for next
      } else {
        clearTimeout(this.timer);
      }
    }, t - now).unref(); // schedule
  }
  get pendingSize() {
    return this.pending.size;
  }
  get cachedSize() {
    return this.cached.size;
  }
  get nextExpirationMs() {
    return this.timer_t;
  }
  clear() {
    this.cached.clear();
    this.pending.clear();
    clearTimeout(this.timer);
    this.timer_t = Infinity;
  }
  // async resolvePending() {
  // 	await Promise.all(Array.from(this.pending.values()));
  // }
  set(key: K, value: V | Promise<V>, ms?: number) {
    this.delete(key);
    ms ??= this.cacheMs;
    if (this.maxCached > 0 && ms > 0) {
      if (this.cached.size >= this.maxCached) {
        // we need room
        // TODO: this needs a heap
        for (const [key] of Array.from(this.cached)
          .sort((a, b) => a[1][0] - b[1][0])
          .slice(-Math.ceil(this.maxCached / 16))) {
          // remove batch
          this.cached.delete(key);
        }
      }
      const exp = clock() + ms;
      this.cached.set(key, [exp, Promise.resolve(value)]); // add cache entry
      this.schedule(exp);
    }
  }
  delete(key: K) {
    this.cached.delete(key);
    this.pending.delete(key);
  }
  cachedRemainingMs(key: K): number {
    const c = this.cached.get(key);
    if (c) {
      const rem = c[0] - clock();
      if (rem > 0) return rem;
    }
    return 0;
  }
  cachedValue(key: K): Promise<V> | undefined {
    const c = this.cached.get(key);
    if (c) {
      const [exp, q] = c;
      if (exp > clock()) return q; // still valid
      this.cached.delete(key); // expired
    }
    return; // ree
  }
  cachedKeys(): IterableIterator<K> {
    return this.cached.keys();
  }
  peek(key: K): Promise<V> | undefined {
    return this.cachedValue(key) ?? this.pending.get(key);
  }
  setPending(key: K, value: Promise<V>, ms?: number): Promise<V> {
    const p = value
      .catch(() => ERR)
      .then((x) => {
        // we got an answer
        if (this.pending.get(key) === p) {
          // remove from pending
          this.set(key, value, x === ERR ? this.errorMs : ms); // add original to cache if existed
        }
        return value; // resolve to original
      });
    this.pending.set(key, p); // remember in-flight
    return p;
  }
  get(key: K, fn: (key: K) => Promise<V>, ms?: number): Promise<V> {
    return this.peek(key) ?? this.setPending(key, fn(key), ms);
  }
}

// keep the last n promises
// setValue(), setPending(), cache(), touch() refresh the key
// awaited pending that are still in the cache refresh the key
// replaced/removed pending values do not overwrite new values
export class LRU<K, V> {
  #map: Map<K, Promise<V>> = new Map();
  #max!: number;
  constructor(max = 8192) {
    this.max = max;
  }
  get size() {
    return this.#map.size;
  }
  get max() {
    return this.#max;
  }
  set max(n: number) {
    if (!Number.isSafeInteger(n) || n < 0) throw new TypeError('expected size');
    this.#max = n;
    const over = this.#map.size - n;
    if (over > 0) this.#deleteOldest(over);
  }
  #set(key: K, promise: Promise<V>) {
    if (this.#max) {
      this.#map.delete(key);
      if (this.#map.size == this.#max) this.#deleteOldest(1);
      this.#map.set(key, promise);
    }
  }
  #deleteOldest(n: number) {
    const iter = this.#map.keys();
    while (n--) this.#map.delete(iter.next().value!);
  }
  keys() {
    return this.#map.keys();
  }
  entries() {
    return this.#map.entries();
  }
  clear() {
    this.#map.clear();
  }
  delete(key: K) {
    this.#map.delete(key);
  }
  setValue(key: K, value: V) {
    this.#set(key, Promise.resolve(value));
  }
  setPending(key: K, promise: Promise<V>) {
    const p = promise.then(
      (x) => {
        if (this.#map.get(key) === p) this.setValue(key, x);
        return x;
      },
      (x) => {
        if (this.#map.get(key) === p) this.#map.delete(key);
        throw x;
      }
    );
    this.#set(key, p);
    return p;
  }
  setFuture(key: K, promise: Promise<V>) {
    this.setPending(key, promise).catch(() => {});
  }
  peek(key: K) {
    return this.#map.get(key);
  }
  touch(key: K) {
    const p = this.#map.get(key);
    if (p) this.#set(key, p);
    return p;
  }
  cache(key: K, fn: (key: K) => Promise<V>) {
    return this.touch(key) ?? this.setPending(key, fn(key));
  }
}
