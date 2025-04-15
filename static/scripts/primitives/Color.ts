export class RGBA {
  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  serialize() {
    return [this.r, this.g, this.b, this.a];
  }
}

const isValidHex = (hex: string) => /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);

const getChunksFromString = (st: string, chunkSize: number) =>
  st.match(new RegExp(`.{${chunkSize}}`, "g"));

const convertHexUnitTo256 = (hexStr: string) =>
  parseInt(hexStr.repeat(2 / hexStr.length), 16);

const getAlphaFloat = (a: number, alpha: number) => {
  if (typeof a !== "undefined") {
    return a / 255;
  }

  if (typeof alpha != "number" || alpha < 0 || alpha > 1) {
    return 1;
  }

  return alpha;
};

export const Color = {
  fromHex: (hex: string, alpha = 1) => {
    if (!isValidHex(hex)) {
      throw new Error("invalid hex: " + hex);
    }

    const chunkSize = Math.floor((hex.length - 1) / 3);
    const hexArr = getChunksFromString(hex.slice(1), chunkSize);

    if (!hexArr) {
      throw new Error("invalid hex: " + hex);
    }

    const [r, g, b, a] = hexArr.map(convertHexUnitTo256);

    return new RGBA(r / 255, g / 255, b / 255, getAlphaFloat(a, alpha));
  },

  fromRGBA: (r: number, g: number, b: number, a = 1) => {
    return new RGBA(r / 255, g / 255, b / 255, a);
  },
};

export default Color;
