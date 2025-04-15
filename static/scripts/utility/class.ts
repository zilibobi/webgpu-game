const valueFieldSymbol = Symbol();

export function setClassFieldChangeCallback(
  obj: any,
  keyFilter: RegExp,
  callback: (key: string, old: any, current: any) => void,
) {
  let map = obj[valueFieldSymbol];

  if (!map) {
    map = new Map() as Map<string, any>;
    obj[valueFieldSymbol] = map;
  }

  for (const [k, v] of Object.entries(obj)) {
    if (!keyFilter.test(k) || map.has(k)) continue;

    map.set(k, v);

    Object.defineProperty(obj, k, {
      set(value) {
        const old = map.get(k);

        map.set(k, value);
        callback(k, old, value);
      },
      get() {
        return map.get(k);
      },
    });
  }
}
