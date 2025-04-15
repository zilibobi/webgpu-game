export function assign(offset: number, from: any[], to: any[]) {
  let i = 0;

  for (const j of from) {
    to[offset + i] = j;
    i++;
  }

  // next offset
  return offset + i;
}

export function padFloat32Array(arr: number[]) {
  const byteLength = arr.length * 4;

  const remainder = byteLength % 16;
  const extraPadding = remainder != 0 ? 16 - remainder : 0;

  if (extraPadding > 0) {
    arr = arr.concat(Array(extraPadding / 4).fill(0));
  }

  return arr;
}
