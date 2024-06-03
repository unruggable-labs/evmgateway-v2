// SmartCache maintains 2 maps:
// 1) pending promises by key
// 2) settled promises by key + expiration
// requests for the same key return the same promise
// which may be from (1) or (2)
// too many pending {max_pending} are errors
// too many cached {max_cached} purge the oldest
// resolved promises are cached for {ms}
// rejected promises are cached for {ms_error}

const ERR = Symbol();

function clock() {
	return Math.ceil(performance.now());
}

type CachedValueFunction<T> = () => Promise<T>;
export class CachedValue<T> {
	readonly fn;
	readonly ms_success;
	readonly ms_error;
	private exp: number = 0;
	private value: Promise<T> | undefined;
	constructor(fn: CachedValueFunction<T>, ms: number, ms_error?: number) {
		this.fn = async () => fn();
		this.ms_success = ms;
		this.ms_error = ms_error ?? Math.ceil(ms / 4);
	}
	get peek(): Promise<T> | undefined {
		return this.value;
	}
	get(): Promise<T> {
		if (this.value && this.exp > clock()) return this.value;
		this.exp = Infinity; // mark as in-flight
		let p = this.value = this.fn(); // begin
		return p.catch(() => ERR).then((x: T | Symbol) => {
			this.exp = clock() + (x === ERR ? this.ms_error : this.ms_success);
			return p;
		});
	}
}

export class SmartCache<K = any, V = any> {
	private readonly cached: Map<K,[exp: number, promise: Promise<V>]> = new Map();
	private readonly pending: Map<K,Promise<V>> = new Map();
	private timer: Timer | undefined;
	private timer_t: number = Infinity;
	readonly ms_success;
	readonly ms_error;
	readonly ms_slop;
	readonly max_cached;
	readonly max_pending;
	constructor({ms = 60000, ms_error, ms_slop = 50, max_cached = 10000, max_pending = 100}: {
		ms?: number;
		ms_error?: number;
		ms_slop?: number;
		max_cached?: number;
		max_pending?: number;
	} = {}) {
		this.ms_success = ms;
		this.ms_error = ms_error ?? Math.ceil(ms / 4);
		this.ms_slop = ms_slop;
		this.max_cached = max_cached;
		this.max_pending = max_pending;
	}
	private schedule(exp: number) {
		let now = clock();
		let t = Math.max(now + this.ms_slop, exp);
		if (this.timer_t < t) return; // scheduled and shorter
		clearTimeout(this.timer); // kill old
		this.timer_t = t; // remember fire time
		this.timer = setTimeout(() => {
			let now = clock();
			let min = Infinity;
			for (let [key, [exp]] of this.cached) {
				if (exp < now) {
					this.cached.delete(key);
				} else {
					min = Math.min(min, exp); // find next
				}
			}
			this.timer_t = Infinity;
			if (this.cached.size) {
				this.schedule(min); // schedule for next
			} else {
				clearTimeout(this.timer);
			}
		}, t - now).unref(); // schedule
	}
	clear() {
		this.cached.clear();
		this.pending.clear();
		clearTimeout(this.timer);
		this.timer_t = Infinity;
	}
	add(key: K, value: V | Promise<V>, ms?: number) {
		if (!ms) ms = this.ms_success;
		if (this.cached.size >= this.max_cached) { // we need room
			// TODO: this needs a heap
			for (let [key] of [...this.cached].sort((a, b) => a[1][0] - b[1][0]).slice(-Math.ceil(this.max_cached/16))) { // remove batch
				this.cached.delete(key);
			}
		}
		let exp = clock() + ms;
		this.cached.set(key, [exp, Promise.resolve(value)]); // add cache entry
		this.schedule(exp);
	}
	peekCached(key: K): Promise<V> | undefined {
		let c = this.cached.get(key);
		if (c) {
			let [exp, q] = c;
			if (exp > clock()) return q; // still valid
			this.cached.delete(key); // expired
		}
		return; // ree
	}
	peek(key: K): Promise<V> | undefined {
		return this.peekCached(key) ?? this.pending.get(key);
	}
	get(key: K, fn: (key: K) => Promise<V>, ms?: number): Promise<V> {
		let p = this.peek(key);
		if (p) return p;
		if (this.pending.size >= this.max_pending) throw new Error('busy'); // too many in-flight
		let q = fn(key); // begin
		p = q.catch(() => ERR).then(x => { // we got an answer
			if (this.pending.delete(key)) { // remove from pending
				this.add(key, q, x && x !== ERR ? ms : this.ms_error); // add original to cache if existed
			}
			return q; // resolve to original
		});
		this.pending.set(key, p); // remember in-flight
		return p; // return original
	}
}
