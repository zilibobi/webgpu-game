import View from "./components/View";
import Frame from "./components/interface/Frame";
import FlappyBird from "./flappy";
import Color from "./primitives/Color";

import { MultiVector, UVec2, Vector2 } from "./primitives/Vector";

const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("no canvas found in the page");
}

const view = new View(canvas);

const RES_WIDTH = 500;
const RES_HEIGHT = 1000;

view.Camera.Resolution = new Vector2(RES_WIDTH, RES_HEIGHT);

const frame = new Frame(view);
frame.Fixed = true;
frame.Size = UVec2.fromAbs(25, 25);
frame.Position = UVec2.fromRel(0.5, 0.5);

const pipes = new Set();

const PIPE_GAP = 200;
const PIPE_WIDTH = 100;

function rng(min: number, max: number) {
  return min + (max - min) * Math.random();
}

function pipeGen(y: number, factor: number, height: number) {
  const pipe = new Frame(view);

  pipe.BackgroundColor = Color.fromHex("#36e379");

  pipe.Size = UVec2.fromAbs(
    PIPE_WIDTH,
    RES_HEIGHT * height + (PIPE_GAP / 2) * -1,
  );

  pipe.Position = new MultiVector(
    1,
    -view.Camera.Position.x + PIPE_WIDTH * 2,
    y,
    factor + (PIPE_GAP / 2) * factor,
  );

  pipes.add(pipe);
}

const genStage = () => {
  const pos = rng(0.25, 0.75);

  pipeGen(pos / 2, -1, pos * 0.5); // top
  pipeGen(1 - (1 - pos) / 2, 1, (1 - pos) * 0.5); // bottom
};

genStage();

setInterval(genStage, 1500);

const bird = new FlappyBird();

view.PreRender.Connect((deltaTime) => {
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;

  pipes.forEach((p: Frame) => p._update());

  frame._update();

  view.Camera.Position.x -= 500 * deltaTime;
});

document.addEventListener("keydown", (e) => {
  if (e.key != " ") {
    return;
  }

  bird.jump();
});

//view.PreRender.Connect((deltaTime) => {
//  view.Camera.Position.y += 2 * deltaTime;
//});
