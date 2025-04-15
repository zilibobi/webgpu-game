import Character from "./components/Character";
import Grid, { Cell } from "./components/Grid";
import Vector2 from "./primitives/Vector2";
import Color from "./primitives/Color";

import { mat4, vec3 } from "wgpu-matrix";

const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("no canvas found in the page");
}

if (!navigator.gpu) {
  throw new Error("WebGPU not supported on this browser.");
}

const adapter = await navigator.gpu.requestAdapter();

if (!adapter) {
  throw new Error("No appropriate GPUAdapter found.");
}

const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu");

if (!context) {
  throw new Error("could not get wgpu canvas context");
}

const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device: device,
  format: canvasFormat,
});

const screenSize = new Vector2(0, 0);
const mousePosition = new Vector2(0, 0);

function onResize() {
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;

  screenSize.x = canvas.width;
  screenSize.y = canvas.height;
}

window.addEventListener("resize", onResize);

onResize();

window.addEventListener("mousemove", (e) => {
  mousePosition.x = e.x;
  mousePosition.y = e.y;
});

const PI = Math.PI;
const TAU = PI * 2;

function slerp(a: number, b: number, t: number) {
  t = Math.max(0, Math.min(1, t));

  let delta = b - a;

  delta = ((delta % TAU) + TAU) % TAU;

  if (delta > PI) {
    delta -= 2 * PI;
  }

  const result = a + delta * t;

  return ((result % TAU) + TAU) % TAU;
}

function inverseDeltaDecay(decay: number, deltaTime: number) {
  return 1 - Math.exp(-decay * deltaTime);
}

async function setup() {
  var depthTexture: GPUTexture;

  const grid = new Grid(device, canvasFormat, 4);

  await grid.loadFontMap("static/assets/font.png", "static/assets/font.json");

  const c = new Cell("a");
  c.background_color = Color.fromRGBA(255, 0, 0, 0.5);
  c.position = new Vector2(0, 1);

  grid.addCell(c);

  const playerBodyCell = new Cell("o");
  playerBodyCell.scale = 1 / 128;
  playerBodyCell.moves_with_camera = false;
  playerBodyCell.background_color = Color.fromRGBA(0, 255, 0, 0.5);

  grid.addCell(playerBodyCell);

  const playerArrowCell = new Cell("^");
  playerArrowCell.scale = 1 / 256;
  playerArrowCell.pivot = playerBodyCell;

  grid.addCell(playerArrowCell);

  let arrowRotation = 0;
  const arrowPosition = new Vector2(0, 0);

  const character = new Character();

  var lastTimestamp = 0;

  function render(timestamp: number) {
    if (
      !depthTexture ||
      depthTexture.width != screenSize.x ||
      depthTexture.height != screenSize.y
    ) {
      depthTexture = device.createTexture({
        size: [screenSize.x, screenSize.y],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    const deltaTime = (timestamp - lastTimestamp) / 1000;

    character.frame(deltaTime);

    let rotation = Math.atan2(
      mousePosition.y - screenSize.y / 2,
      mousePosition.x - screenSize.x / 2,
    );

    if (rotation < 0) {
      rotation = Math.PI * 2 + rotation;
    }

    rotation = -rotation;

    const RADIUS = 0.5;

    const px = RADIUS * Math.cos(rotation);
    const py = RADIUS * Math.sin(rotation);

    arrowPosition.lerp(new Vector2(px, py), inverseDeltaDecay(20, deltaTime));
    arrowRotation = slerp(
      arrowRotation,
      rotation - Math.PI / 2,
      inverseDeltaDecay(10, deltaTime),
    );

    const pos = mat4.rotateZ(
      mat4.translation([arrowPosition.x, arrowPosition.y, 0]),
      arrowRotation,
    );

    playerArrowCell.transform = pos;

    grid.updateCell(playerArrowCell);

    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
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

    grid.render(pass, timestamp / 1000, character.position, screenSize);
    pass.end();

    device.queue.submit([encoder.finish()]);

    lastTimestamp = timestamp;

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

await setup();
