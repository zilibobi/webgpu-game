import Vector2 from "../primitives/Vector2";

const UP = new Vector2(0, 1);
const DOWN = new Vector2(0, -1);
const LEFT = new Vector2(-1, 0);
const RIGHT = new Vector2(1, 0);

const MOVE_KEYBINDS: Record<string, Vector2> = {
  w: DOWN,
  s: UP,
  a: RIGHT,
  d: LEFT,
};

const keybindsDown: Set<string> = new Set();

export default class Character {
  speed: number;
  position: Vector2;

  private keyUpPropagator: (event: DocumentEventMap["keyup"]) => void;
  private keyDownPropagator: (event: DocumentEventMap["keydown"]) => void;

  readonly moveDir: Vector2;

  constructor() {
    this.speed = 10_000;

    this.moveDir = new Vector2(0, 0);
    this.position = new Vector2(0, 0);

    this.keyUpPropagator = (event) => {
      this.handleInput(event.key, false);
    };

    this.keyDownPropagator = (event) => {
      this.handleInput(event.key, true);
    };

    document.addEventListener("keyup", this.keyUpPropagator);
    document.addEventListener("keydown", this.keyDownPropagator);
  }

  private handleInput(key: string, down: boolean) {
    if (down && keybindsDown.has(key)) {
      return;
    }

    const vector = MOVE_KEYBINDS[key];

    if (!vector) {
      return;
    }

    const factor = down ? 1 : -1;

    this.moveDir.x += vector.x * factor;
    this.moveDir.y += vector.y * factor;

    if (down) {
      keybindsDown.add(key);
    } else {
      keybindsDown.delete(key);
    }
  }

  frame(deltaTime: number) {
    this.position.x += this.moveDir.x * deltaTime;
    this.position.y += this.moveDir.y * deltaTime;
  }

  destroy() {
    document.removeEventListener("keyup", this.keyUpPropagator);
    document.removeEventListener("keydown", this.keyDownPropagator);
  }
}
