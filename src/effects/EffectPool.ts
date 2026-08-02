export class EffectPool<T extends { active: boolean }> {
  constructor(private readonly items: T[]) {}
  acquire(): T { return this.items.find((item) => !item.active) ?? this.items[0]; }
  get activeCount(): number { return this.items.filter((item) => item.active).length; }
}
