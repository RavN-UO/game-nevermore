/**
 * A tiny generic object pool. We never instantiate/destroy obstacles, souls or
 * particle data mid-run — we recycle from here to avoid GC stutter (BRIEF §2).
 */
export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly factory: () => T;
  private readonly onReset?: (item: T) => void;

  constructor(factory: () => T, prewarm = 0, onReset?: (item: T) => void) {
    this.factory = factory;
    this.onReset = onReset;
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }

  obtain(): T {
    const item = this.free.pop() ?? this.factory();
    return item;
  }

  release(item: T): void {
    this.onReset?.(item);
    this.free.push(item);
  }

  get available(): number {
    return this.free.length;
  }
}
