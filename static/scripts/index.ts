import View from "./components/View";
import Frame from "./components/interface/Frame";

import Player from "./player";
import Color from "./primitives/Color";

import { MultiVector, UVec2, Vector2 } from "./primitives/Vector";

const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("no canvas found in the page");
}

const view = new View(canvas);

const RES_WIDTH = 800;
const RES_HEIGHT = 800;

const PLAYER_SIZE = 50;

canvas.width = RES_WIDTH;
canvas.height = RES_HEIGHT;

view.Camera.Resolution = new Vector2(RES_WIDTH, RES_HEIGHT);

const frame = new Frame(view);
frame.Fixed = true;
frame.Size = UVec2.fromAbs(PLAYER_SIZE, PLAYER_SIZE);
frame.AnchorPoint = new Vector2(0.5, 0.5);
frame.Position = UVec2.fromRel(0.5, 0.5);

const pipes = new Set();

const PIPE_GAP = 0.3;
const PIPE_WIDTH = 100;

var lastPipe: Frame;
var lastPipePos: number;
var genIntervalIndex: number;

const playerSizeNorm = PLAYER_SIZE / RES_HEIGHT;

function rng(min: number, max: number) {
  return min + (max - min) * Math.random();
}

function pipeGen(y_anchor: number, height: number) {
  const pipe = new Frame(view);

  pipe.AnchorPoint = new Vector2(0, y_anchor);
  pipe.BackgroundColor = Color.fromHex("#36e379");

  pipe.Size = UVec2.fromAbs(PIPE_WIDTH, RES_HEIGHT * (height - PIPE_GAP / 2));

  pipe.Position = new MultiVector(
    1,
    -view.Camera.Position.x + PIPE_WIDTH * 2,
    y_anchor,
    0,
  );

  pipes.add(pipe);
  lastPipe = pipe;
}

let score = -1;

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("hiscore");

highScoreElement.innerText = `HI: ${localStorage.getItem("hiscore") || 0}`;

const genStage = () => {
  const pos = rng(0.2, 0.8);

  lastPipePos = pos;

  pipeGen(0, pos); // top
  pipeGen(1, 1 - pos); // bottom

  score += 1;

  scoreElement.innerText = `SCORE: ${score}`;
};

genStage();

genIntervalIndex = setInterval(genStage, 3000);

let elapsedTime = 0;
let xpos = 0;

const player = new Player();

view.PreRender.Connect((deltaTime) => {
  pipes.forEach((p: Frame) => {
    const offset = 300 * deltaTime;

    p.Position.abs_x -= offset;
    xpos += offset;

    if (p.Position.abs_x + PIPE_WIDTH < -RES_WIDTH) {
      p.destroy();
      pipes.delete(p);

      return;
    }

    p._update();
  });

  const plrPosNorm =
    0.5 + player.getposition(elapsedTime) / view.Camera.ViewportSize.y;

  if (lastPipe) {
    if (
      plrPosNorm + playerSizeNorm / 2 >= 1 ||
      // check if in the pipe's x axis
      (lastPipe.Position.abs_x >=
        -RES_WIDTH / 2 - PIPE_WIDTH / 2 - PLAYER_SIZE && // left-to-right
        lastPipe.Position.abs_x <=
          -RES_WIDTH / 2 + PIPE_WIDTH / 2 - PLAYER_SIZE / 2 && // right-to-left
        // check if outside the gap
        (plrPosNorm > lastPipePos + PIPE_GAP / 2 - playerSizeNorm / 2 || // bottom
          plrPosNorm < lastPipePos - PIPE_GAP / 2 + playerSizeNorm / 2)) // top
    ) {
      player.reset();

      if (score > localStorage.getItem("hiscore") || 0) {
        localStorage.setItem("hiscore", score.toString());
        highScoreElement.innerText = `HI: ${score}`;
      }

      score = -1;
      elapsedTime = 0;

      scoreElement.innerText = "SCORE: 0";

      pipes.forEach((p2: Frame) => p2.destroy());

      pipes.clear();

      clearTimeout(genIntervalIndex);
      genIntervalIndex = setInterval(genStage, 3000);

      genStage();
    }
  }

  frame.Position.abs_y = player.getposition(elapsedTime);
  frame._update();

  elapsedTime += deltaTime * 4;
});

document.addEventListener("keydown", (e) => {
  if (e.key != " ") {
    return;
  }

  player.jump(elapsedTime);
});

document.addEventListener("pointerdown", (_) => {
  player.jump(elapsedTime);
});
