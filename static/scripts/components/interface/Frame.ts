import RenderObject from "../RenderObject";
import type { View } from "../View";

import frameShader from "../../../shaders/frame.txt";
import { setClassFieldChangeCallback } from "../../utility/class";

export default class Frame extends RenderObject {
  constructor(view: View) {
    super(view, "Frame");

    view._addRenderObject({
      obj: this,

      vert_shader: frameShader,
      frag_shader: frameShader,

      vertex_count: 4,
    });

    setClassFieldChangeCallback(this, new RegExp(/^[A-z]/), () => {
      console.log("changed!!!");
      view._updateRenderObject(this);
    });
  }
}
