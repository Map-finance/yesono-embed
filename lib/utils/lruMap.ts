/**
 * LRUMap - 简易 LRU 容器,基于 Map 的插入顺序特性实现
 *
 * 用法:
 *   const cache = new LRUMap<string, MyType>(100);
 *   cache.set("k", v); cache.get("k"); cache.delete("k"); cache.has(...); cache.clear();
 *
 * 设计:
 * - 容量超限时淘汰最早访问的条目(Map 的迭代顺序即插入顺序;命中后重新 set 把它推到末尾)。
 * - 不引入外部依赖,适合"模块级单例缓存"场景(防长会话内存无界增长)。
 */
export class LRUMap<K, V> {
  private readonly max: number;
  private readonly map: Map<K, V>;

  constructor(max: number) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error("LRUMap: max must be a positive integer");
    }
    this.max = max;
    this.map = new Map();
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // touch: 命中后重新插到末尾,标记为"最近使用"
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  /** 不更新使用顺序的查看(用于不影响 LRU 排名的窥探) */
  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      // 淘汰最早条目(Map 迭代顺序最先的那个)
      const oldest = this.map.keys().next();
      if (!oldest.done) {
        this.map.delete(oldest.value);
      }
    }
    this.map.set(key, value);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  forEach(cb: (value: V, key: K) => void): void {
    this.map.forEach(cb);
  }

  /** 与 Map 一致的迭代器接口(注意:迭代不更新 LRU 顺序) */
  values(): IterableIterator<V> {
    return this.map.values();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map[Symbol.iterator]();
  }
}
