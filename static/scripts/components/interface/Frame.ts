import RenderObject from "../RenderObject";
import type { View } from "../View";

import frameShader from "../../../shaders/frame.txt";
import { setClassFieldChangeCallback } from "../../utility/class";
import { Color, type RGBA } from "../../primitives/Color";

export default class Frame extends RenderObject {
  BackgroundColor: RGBA;

  constructor(view: View) {
    super(view, "Frame");

    this.BackgroundColor = Color.fromHex("#fff");

    view._addRenderObject({
      obj: this,

      vert_shader: frameShader,
      frag_shader: frameShader,

      vertex_count: 4,
    });

    setClassFieldChangeCallback(this, new RegExp(/^[A-z]/), () => {
      this._update();
    });
  }
}
