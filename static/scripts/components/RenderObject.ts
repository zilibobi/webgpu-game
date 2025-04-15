import { MultiVector, Vector2 } from "../primitives/Vector";
import { setClassFieldChangeCallback } from "../utility/class";

import type View from "./View";

export default class RenderObject {
  readonly view: View;

  readonly Children: Set<RenderObject>;

  Parent?: RenderObject;

  ClassName: string;

  AnchorPoint: Vector2;

  Size: MultiVector;
  Position: MultiVector;

  ZIndex: number;

  Fixed: boolean;
  Visible: boolean;

  constructor(view: View, class_name: string) {
    this.ClassName = class_name;
    this.AnchorPoint = new Vector2(0, 0);

    this.Size = new MultiVector();
    this.Position = new MultiVector();

    this.ZIndex = -1;

    this.Fixed = false;
    this.Visible = false;

    this.Children = new Set();

    this.view = view;

    setClassFieldChangeCallback(
      this,
      new RegExp(/^Parent$/),
      (_, old, current) => {
        if (old instanceof RenderObject) {
          old.Children.delete(this);
        }

        if (current instanceof RenderObject) {
          current.Children.add(this);
          current._update();
        } else {
          throw new Error(
            "the parent of a render object can only be another render object.",
          );
        }
      },
    );
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

  _update() {
    this.view._updateRenderObject(this);

    for (const obj of this.Children.values()) {
      obj._update();
    }
  }
}
