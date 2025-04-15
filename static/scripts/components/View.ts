import Event from "../primitives/Event";
import { Vector2, Vector3 } from "../primitives/Vector";

import type RenderObject from "./RenderObject";

import { mat4, vec3 } from "wgpu-matrix";
import {
  getSizeAndAlignmentOfUnsizedArrayElement,
  makeShaderDataDefinitions,
  makeStructuredView,
  type StructuredView,
  type VariableDefinition,
} from "webgpu-utils";
import { snakeToPascal } from "../utility/string";

type MSDFFontData = {
  pages: string[];
  chars: {
    id: number;
    index: number;
    char: string;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    chnl: number;
    x: number;
    y: number;
    page: number;
  }[];
  info: {
    face: string;
    size: number;
    bold: number;
    italic: number;
    charset: string[];
    unicode: number;
    stretchH: number;
    smooth: number;
    aa: number;
    padding: number[];
    spacing: number[];
  };
  common: {
    lineHeight: number;
    base: number;
    scaleW: number;
    scaleH: number;
    pages: number;
    packed: number;
    alphaChnl: number;
    redChnl: number;
    greenChnl: number;
    blueChnl: number;
  };
  distanceField: {
    fieldType: string;
    distanceRange: number;
  };
  kernings: {
    first: number;
    second: number;
    amount: number;
  }[];
};

export class RenderDescriptor {
  view: View;
  uniform_view: StructuredView;

  time: number;
  delta_time: number;

  constructor(view: View) {
    this.view = view;

    this.time = 0;
    this.delta_time = 0;

    const code = `
    struct RenderDescriptor {
      time: f32,
      delta_time: f32,
    
      view: mat4x4f,
      static_view: mat4x4f,
    }
    
    @group(0) @binding(0) var<uniform> desc: RenderDescriptor;
    `;

    const defs = makeShaderDataDefinitions(code);
    const uniform = makeStructuredView(defs.uniforms.desc);

    this.uniform_view = uniform;
  }

  update() {
    const camera = this.view.Camera;

    const perspective = mat4.perspective(
      (camera.FieldOfView * Math.PI) / 180,
      camera.ViewportSize.x / camera.ViewportSize.y,
      camera.Near,
      camera.Far,
    );

    this.uniform_view.set({
      time: this.time,
      delta_time: this.delta_time,
    });

    mat4.translate(
      perspective,
      vec3.fromValues(...camera.Position.serialize()),
      this.uniform_view.views.view,
    );

    mat4.translate(
      perspective,
      vec3.fromValues(0, 0, camera.Position.z),
      this.uniform_view.views.static_view,
    );
  }
}

interface RenderInfo {
  buf: StructuredView;
  def: VariableDefinition;

  objs: Map<RenderObject, object>;
  obj_size: number;

  vertex_count: number;

  prop_buf: GPUBuffer;
  pipeline: GPURenderPipeline;

  bind_group: GPUBindGroup;
  extra_bind_group?: GPUBindGroup;
}

interface AddRenderObjectParams {
  obj: RenderObject;

  vert_shader: string;
  frag_shader: string;

  vertex_count: number;

  entries?: GPUBindGroupEntry[];
  entry_layouts?: GPUBindGroupLayoutEntry[];
}

interface Camera {
  Position: Vector3;
  ViewportSize: Vector2;

  FieldOfView: number;

  Near: number;
  Far: number;
}

if (!navigator.gpu) {
  throw new Error("WebGPU not supported in this browser");
}

const adapter = await navigator.gpu.requestAdapter();

if (!adapter) {
  throw new Error("No appropriate GPUAdapter found");
}

const device = await adapter.requestDevice();

export default class View {
  private device: GPUDevice;

  private render_info: Map<string, RenderInfo>;
  private render_descriptor: RenderDescriptor;

  private render_descriptor_buffer: GPUBuffer;

  readonly Camera: Camera;

  PreRender: Event<[number]>;
  PostRender: Event<[RenderDescriptor]>;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("webgpu") as GPUCanvasContext;

    if (!context) {
      throw new Error("WebGPU canvas context is unavailable");
    }

    context.configure({
      device: device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });

    this.device = device;

    this.render_info = new Map();
    this.render_descriptor = new RenderDescriptor(this);

    // Properties
    this.Camera = {
      Position: new Vector3(0, 0, -10),
      ViewportSize: new Vector2(),
      FieldOfView: 60,
      Near: 0.1,
      Far: 20,
    };

    // Event definitions
    this.PreRender = new Event();
    this.PostRender = new Event();

    this.render_descriptor_buffer = device.createBuffer({
      label: "View::RenderDescriptorBuffer",
      size: this.render_descriptor.uniform_view.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    var lastTimeMs = 0;
    var depthTexture: GPUTexture;

    const view = this;

    // Render loop
    function render(timeMs: number) {
      const deltaTime = (timeMs - lastTimeMs) / 1000;
      lastTimeMs = timeMs;

      view.PreRender.Emit(deltaTime);

      view.Camera.ViewportSize.x = canvas.width;
      view.Camera.ViewportSize.y = canvas.height;

      if (
        !depthTexture ||
        depthTexture.width != view.Camera.ViewportSize.x ||
        depthTexture.height != view.Camera.ViewportSize.y
      ) {
        depthTexture = device.createTexture({
          label: "View::DepthTexture",
          size: [view.Camera.ViewportSize.x, view.Camera.ViewportSize.y],
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }

      const encoder = device.createCommandEncoder();

      const pass = encoder.beginRenderPass({
        label: "View::RenderPass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      view.render_descriptor.time = timeMs / 1000;
      view.render_descriptor.delta_time = deltaTime;

      view.render_descriptor.update();

      view.device.queue.writeBuffer(
        view.render_descriptor_buffer,
        0,
        view.render_descriptor.uniform_view.arrayBuffer,
      );

      for (const [className, info] of view.render_info.entries()) {
        pass.setPipeline(info.pipeline);

        pass.setBindGroup(0, info.bind_group);

        if (info.extra_bind_group) {
          pass.setBindGroup(1, info.extra_bind_group);
        }

        pass.draw(info.vertex_count, info.objs.size);
        pass.end();

        device.queue.submit([encoder.finish()]);
      }

      view.PostRender.Emit(view.render_descriptor);

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  _getRenderObjectData(obj: RenderObject, info: RenderInfo) {
    const data: { [key: string]: number | number[] } = {};

    for (const key in info.buf.views[0]) {
      const prop = snakeToPascal(key);

      // @ts-ignore
      const val = obj[prop];

      if (!Object.hasOwn(obj, prop)) {
        throw new Error(
          `property '${key}' defined in the shader doesn't exist on '${obj.ClassName}' as '${prop}'`,
        );
      }

      if (typeof val == "object" && typeof val.serialize == "function") {
        const res = val.serialize(this.render_descriptor);

        if (res) {
          data[key] = res;
        }
      } else if (typeof val == "number") {
        data[key] = val;
      } else if (typeof val == "boolean") {
        data[key] = val ? 1 : 0;
      } else {
        throw new Error(
          `serialization failed: unsupported property '${prop}' data type '${typeof val}'`,
        );
      }
    }

    return data;
  }

  _updateRenderObject(obj: RenderObject) {
    const info = this.render_info.get(obj.ClassName) as RenderInfo;

    if (!info) {
      throw new Error(
        `'${obj.ClassName}' objects haven't been added yet. call '_addRenderObject' before updating this object.`,
      );
    }

    const objInfo = info.objs.get(obj);

    if (!objInfo) {
      throw new Error(
        `this object has not been added yet, so it can't be updated. call '_addRenderObject' on it.`,
      );
    }

    info.objs.set(obj, this._getRenderObjectData(obj, info));

    info.buf.set([info.objs.values()]);

    this.device.queue.writeBuffer(info.prop_buf, 0, info.buf.arrayBuffer);
  }

  _addRenderObject(params: AddRenderObjectParams) {
    let info = this.render_info.get(params.obj.ClassName) as RenderInfo;

    const layout = this.device.createBindGroupLayout({
      entries: [
        // Render descriptor buffer
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        // Property buffer
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    if (!info) {
      const def = makeShaderDataDefinitions(params.vert_shader).storages.props;
      const { size } = getSizeAndAlignmentOfUnsizedArrayElement(def);

      var extraLayout;

      if (params.entry_layouts) {
        extraLayout = this.device.createBindGroupLayout({
          entries: params.entry_layouts || [],
        });
      }

      // @ts-ignore
      info = {
        def: def,

        objs: new Map(),
        obj_size: size,

        vertex_count: params.vertex_count,

        pipeline: params.obj.createPipeline(
          this.device,
          extraLayout ? [layout, extraLayout] : [layout],
          params.vert_shader,
          params.frag_shader,
        ),

        extra_bind_group:
          params.entries && extraLayout
            ? this.device.createBindGroup({
                label: `RenderObject.${params.obj.ClassName}::ExtraBindGroup`,
                layout: extraLayout,
                entries: params.entries,
              })
            : undefined,
      };
    }

    info.buf = makeStructuredView(
      info.def,
      new ArrayBuffer(info.obj_size * (info.objs.size + 1)),
    );

    info.objs.set(params.obj, this._getRenderObjectData(params.obj, info));

    info.buf.set([info.objs.values()]);

    info.prop_buf = this.device.createBuffer({
      label: `RenderObject.${params.obj.ClassName}::PropertyBuffer`,
      size: info.buf.arrayBuffer.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(info.prop_buf, 0, info.buf.arrayBuffer);

    info.bind_group = this.device.createBindGroup({
      label: `RenderObject.${params.obj.ClassName}::BindGroup`,
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: this.render_descriptor_buffer } },
        { binding: 1, resource: { buffer: info.prop_buf } },
      ],
    });

    this.render_info.set(params.obj.ClassName, info);

    // TODO: remove object when it's destroying
    // with the Destroying event

    // OR DELETE IN THE OBJ ITSELF <<<
  }

  async createFont(imageURL: string, jsonURL: string) {
    const image = await fetch(imageURL);
    const imageBitmap = await createImageBitmap(await image.blob());

    const [srcWidth, srcHeight] = [imageBitmap.width, imageBitmap.height];

    const imageTexture = this.device.createTexture({
      size: [srcWidth, srcHeight, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: imageTexture },
      [imageBitmap.width, imageBitmap.height],
    );

    // TODO: import directly
    const res = await fetch(jsonURL);
    const json = (await res.json()) as MSDFFontData;

    const kernings = new Map();

    if (json.kernings) {
      for (const kerning of json.kernings) {
        let charKerning = kernings.get(kerning.first);

        if (!charKerning) {
          charKerning = new Map<number, number>();
          kernings.set(kerning.first, charKerning);
        }

        charKerning.set(kerning.second, kerning.amount);
      }
    }

    return {
      data: json,
      texture: imageTexture,
      kernings: kernings,
    };
  }

  destroy() {}
}
