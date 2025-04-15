const valueFieldSymbol = Symbol();

export function setClassFieldChangeCallback(
  obj: any,
  keyFilter: RegExp,
  callback: (key: string, value: any) => void,
) {
  const map = new Map() as Map<string, any>;

  obj[valueFieldSymbol] = map;

  for (const [k, v] of Object.entries(obj)) {
    if (!keyFilter.test(k)) continue;

    map.set(k, v);

    Object.defineProperty(obj, k, {
      set(value) {
        map.set(k, value);
        callback(k, value);
      },
      get() {
        return map.get(k);
      },
    });
  }
}
