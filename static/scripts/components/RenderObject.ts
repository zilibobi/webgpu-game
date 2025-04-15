import { MultiVector, Vector2 } from "../primitives/Vector";
import { assign } from "../utility/array";

import type View from "./View";
import type { RenderDescriptor } from "./View";

export default class RenderObject {
  readonly view: View;

  readonly Children: Set<RenderObject>;

  Parent?: RenderObject;

  ClassName: string;

  AnchorPoint: Vector2;

  Size: MultiVector;
  Position: MultiVector;

  ZIndex: number;
  Visible: boolean;

  constructor(view: View, class_name: stringa) {
    this.ClassName = class_name;
    this.AnchorPoint = new Vector2(0, 0);

    this.Size = new MultiVector();
    this.Position = new MultiVector();

    this.ZIndex = -1;
    this.Visible = false;

    this.Children = new Set();

    this.view = view;
    this.update_cache = [];
  }

  createPipeline(
    device: GPUDevice,
    layouts: GPUBindGroupLayout[],
    vertex: string,
    fragment: string,
  ) {
    return device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: layouts,
      }),
      label: `RenderObject.${this.ClassName}::Pipeline`,
      vertex: {
        module: device.createShaderModule({
          label: `RenderObject.${this.ClassName}::VertexShader`,
          code: vertex,
        }),
      },
      fragment: {
        module: device.createShaderModule({
          label: `RenderObject.${this.ClassName}::FragmentShader`,
          code: fragment,
        }),
        targets: [
          {
            format: "bgra8unorm",
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-strip",
        stripIndexFormat: "uint32",
      },
      depthStencil: {
        format: "depth24plus",
        depthCompare: "less",
        depthWriteEnabled: false,
      },
    });
  }

  // When Parent is changed, call this for the value
  _addChild() {}

  _update() {
    if (this.Parent && !this.Parent.Children.has(this)) {
      this.Parent.Children.add(this);
    }

    // TODO: Multi vectors can technically change on every frame
    // Instead, it's more performant to only trigger their re-serialization
    // when the relative values are affected (screen size changes)
    // These vectors are also the only ones right now that can trigger their own updates
    // Think of a way to add a way for things to trigger updates and re serialization, not just user input (calling update())
    this.serialize();

    for (const obj of this.Children.values()) {
      obj._update();
    }
  }

  serialize(desc: RenderDescriptor) {
    const data: number[] = [];

    for (const name of this.serialize_order) {
      const prop = this[name as keyof RenderObject];

      if (!Object.hasOwn(this, name)) {
        throw new Error(`property '${name}' doesn't exist`);
      }

      if (
        typeof prop == "object" &&
        // @ts-ignore
        typeof prop.serialize == "function"
      ) {
        // @ts-ignore
        const res = prop.serialize(desc);

        if (res) {
          assign(data.length, res, data);
        }
      } else if (typeof prop == "number") {
        data.push(prop);
      } else if (typeof prop == "boolean") {
        data.push(prop ? 1 : 0);
      } else {
        throw new Error(
          `serialization failed: unsupported property '${name}' data type '${typeof prop}'`,
        );
      }
    }

    this.update_cache = data;

    return data;
  }
}
