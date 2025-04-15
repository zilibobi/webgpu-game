import Vector2 from "../primitives/Vector2";
import { Color, RGBA } from "../primitives/Color";

import gridShader from "../../shaders/grid.txt";

import { mat4, vec3, type Mat4 } from "wgpu-matrix";

export interface RenderDescriptor {
  pass: GPURenderPassEncoder;

  time: number;
  delta_time: number;

  view: Mat4;
  perspective: Mat4;

  instances: number;
  viewport_size: Vector2;
}



interface Font {
  data: MSDFFontData;
  texture: GPUTexture;
  kernings: Map<number, Map<number, number>>;
}

function assign(offset: number, from: any[], to: any[]) {
  let i = 0;

  for (const j of from) {
    to[offset + i] = j;
    i++;
  }

  // next offset
  return offset + i;
}

export class Cell {
  scale: number;
  moves_with_camera: boolean;

  pivot?: Cell;
  position: Vector2;
  transform: Mat4;

  character: string;

  foreground_color: RGBA;
  background_color: RGBA;

  offsetInArray?: number;

  constructor(character: string, scale = 1 / 128) {
    this.scale = scale;
    this.moves_with_camera = true;

    this.position = new Vector2(0, 0);
    this.transform = mat4.identity();

    this.character = character;

    this.foreground_color = Color.fromHex("#fff");
    this.background_color = Color.fromRGBA(255, 255, 255, 0);
  }
}

export default class Grid {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;

  private bindGroup?: GPUBindGroup;
  private bindGroupLayout: GPUBindGroupLayout;

  private cellInfoBuffer?: GPUBuffer;
  private cameraInfoBuffer: GPUBuffer;

  private timestampBuffer: GPUBuffer;
  private timestampArray: Float32Array;

  readonly size: number;

  private cells: Cell[];
  private cellCount: number;

  private cellArray: number[];

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    size: number,
    cells = [] as Cell[],
  ) {
    this.device = device;

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 4,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module: device.createShaderModule({
          code: gridShader,
        }),
      },
      fragment: {
        module: device.createShaderModule({
          code: gridShader,
        }),
        targets: [
          {
            format: format,
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

    this.timestampArray = new Float32Array([0]);
    this.timestampBuffer = this.cameraInfoBuffer = device.createBuffer({
      size: 1 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.cameraInfoBuffer = device.createBuffer({
      size: 2 * 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.size = size;
    this.cells = cells;

    this.cellArray = [];
    this.cellCount = 0;
  }



  updateCell(cell: Cell, noBufferUpdate = false) {
    if (!this.fontData || !this.fontTexture) {
      throw new Error("font map is not loaded");
    }

    if (!this.fontData.info.charset.includes(cell.character)) {
      throw new Error(
        `cell has a character unsupported by the font map: ${cell.character}`,
      );
    }

    if (cell.offsetInArray == undefined) {
      throw new Error(
        "unknown cell offset. use the 'addCell' method on the cell first.",
      );
    }

    const char = this.fontData.chars.find((c) => c.char == cell.character);

    if (!char) {
      return;
    }

    let offset = cell.offsetInArray;

    offset = assign(offset, cell.foreground_color.serialize(), this.cellArray); // fgColor
    offset = assign(offset, cell.background_color.serialize(), this.cellArray); // bgColor

    const u = 1 / this.fontData.common.scaleW;
    const v = 1 / this.fontData.common.scaleH;

    let [px, py] = cell.position.serialize();

    if (cell.pivot) {
      px += cell.pivot.position.x;
      py += cell.pivot.position.y;
    }

    offset = assign(
      offset,
      [
        char.x * u, // texOffset.x
        char.y * v, // texOffset.y

        char.width * u, // texExtent.x
        char.height * v, // texExtent.y

        char.width, // size.x
        char.height, // size.y

        char.xoffset, // offset.x
        -char.yoffset, // offset.y

        px / this.size, // position.x
        py / this.size, // position.y

        cell.scale, // scale
        (cell.pivot ? cell.pivot.moves_with_camera : cell.moves_with_camera)
          ? 1
          : 0, // movesWithCamera
      ],
      this.cellArray,
    );

    offset = assign(offset, Array.from(cell.transform), this.cellArray); // transform

    if (!noBufferUpdate) {
      this.updateCellInfoBuffer();
    }
  }

  addCell(cell: Cell, noBufferUpdate = false) {
    cell.offsetInArray = this.cellArray.length;

    this.updateCell(cell, noBufferUpdate);
    this.cellCount += 1;
  }

  updateCellInfoBuffer() {
    const cellInfoArray = new Float32Array(this.cellArray);

    const remainder = cellInfoArray.byteLength % 16;
    const extraPadding = remainder != 0 ? 16 - remainder : 0;

    this.cellInfoBuffer = this.device.createBuffer({
      size: cellInfoArray.byteLength + extraPadding,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(this.cellInfoBuffer, 0, cellInfoArray);

    this.updateBindGroup();
  }

  updateBindGroup() {
    if (!this.fontData || !this.fontTexture) {
      throw new Error("font map is not loaded");
    }

    if (!this.cellInfoBuffer) {
      throw new Error(
        "can't update because the cell info buffer has not been created yet.",
      );
    }

    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.fontTexture.createView() },
        {
          binding: 1,
          resource: this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
          }),
        },
        { binding: 2, resource: { buffer: this.cellInfoBuffer } },
        { binding: 3, resource: { buffer: this.cameraInfoBuffer } },
        { binding: 4, resource: { buffer: this.timestampBuffer } },
      ],
    });
  }

  render(
    pass: GPURenderPassEncoder,
    timestamp: number,
    position: Vector2,
    viewportSize: Vector2,
  ) {
    if (!this.cellInfoBuffer) {
      throw new Error(
        "cell info buffer has not been created. add some cells before rendering.",
      );
    }

    if (!this.bindGroup) {
      throw new Error(
        "bind group has not been created. add some cells before rendering.",
      );
    }

    this.timestampArray[0] = timestamp;

    const fov = (60 * Math.PI) / 180;

    const aspect = viewportSize.x / viewportSize.y;

    const near = 1;
    const far = 2000;

    const perspective = mat4.perspective(fov, aspect, near, far);

    const view = mat4.translate(
      perspective,
      vec3.fromValues(position.x, position.y, -5),
    );

    const view2 = mat4.translate(perspective, vec3.fromValues(0, 0, -5));

    this.device.queue.writeBuffer(
      this.cameraInfoBuffer,
      0,
      Float32Array.of(...view, ...view2),
    );

    this.device.queue.writeBuffer(this.timestampBuffer, 0, this.timestampArray);

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);

    pass.draw(4, this.cellCount);
  }
}
