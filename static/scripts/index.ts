import View from "./components/View";
import Frame from "./components/interface/Frame";

import { UVec2 } from "./primitives/Vector";

const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("no canvas found in the page");
}

const view = new View(canvas);

const frame = new Frame(view);
frame.Size = UVec2.fromAbs(100, 100);

view.PreRender.Connect(() => {
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;
});

//view.PreRender.Connect((deltaTime) => {
//  view.Camera.Position.y += 2 * deltaTime;
//});
