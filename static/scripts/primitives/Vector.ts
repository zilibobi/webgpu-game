import type { RenderDescriptor } from "../components/View";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class Vector2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(vec: Vector2) {
    this.x += vec.x;
    this.y += vec.y;
  }

  sub(vec: Vector2) {
    this.x -= vec.x;
    this.y -= vec.y;
  }

  mul(vec: Vector2) {
    this.x *= vec.x;
    this.y *= vec.y;
  }

  div(vec: Vector2) {
    this.x /= vec.x;
    this.y /= vec.y;
  }

  lerp(vec: Vector2, alpha: number) {
    const x = lerp(this.x, vec.x, alpha);
    const y = lerp(this.y, vec.y, alpha);

    this.x = x;
    this.y = y;
  }

  serialize() {
    return [this.x, this.y];
  }
}

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(vec: Vector3) {
    this.x += vec.x;
    this.y += vec.y;
    this.z += vec.z;
  }

  sub(vec: Vector3) {
    this.x -= vec.x;
    this.y -= vec.y;
    this.z -= vec.z;
  }

  mul(vec: Vector3) {
    this.x *= vec.x;
    this.y *= vec.y;
    this.z *= vec.z;
  }

  div(vec: Vector3) {
    this.x /= vec.x;
    this.y /= vec.y;
    this.z /= vec.z;
  }

  lerp(vec: Vector3, alpha: number) {
    const x = lerp(this.x, vec.x, alpha);
    const y = lerp(this.y, vec.y, alpha);
    const z = lerp(this.z, vec.z, alpha);

    this.x = x;
    this.y = y;
    this.z = z;
  }

  serialize() {
    return [this.x, this.y, this.z];
  }
}

export class MultiVector {
  rel_x: number;
  abs_x: number;
  rel_y: number;
  abs_y: number;

  constructor(x1 = 0, x2 = 0, y1 = 0, y2 = 0) {
    this.rel_x = x1;
    this.abs_x = x2;
    this.rel_y = y1;
    this.abs_y = y2;
  }

  lerp(vec: MultiVector, alpha: number) {
    const x1 = lerp(this.rel_x, vec.rel_x, alpha);
    const x2 = lerp(this.abs_x, vec.abs_x, alpha);
    const y1 = lerp(this.rel_y, vec.rel_y, alpha);
    const y2 = lerp(this.abs_y, vec.abs_y, alpha);

    this.rel_x = x1;
    this.abs_x = x2;
    this.rel_y = y1;
    this.abs_y = y2;
  }

  toAbs(width: number, height: number) {
    return new Vector2(
      this.abs_x + Math.round(width * this.rel_x),
      this.abs_y + Math.round(height * this.rel_y),
    );
  }

  serialize(desc: RenderDescriptor) {
    const vps = desc.view.Camera.ViewportSize;
    return this.toAbs(vps.x, vps.y).serialize();
  }
}

export const UVec2 = {
  fromAbs: (x: number, y: number) => {
    return new MultiVector(0, x, 0, y);
  },

  fromRel: (x: number, y: number) => {
    return new MultiVector(x, 0, y, 0);
  },
};
