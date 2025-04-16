const ACCELERATION = 100;
const JUMP_VELOCITY = -150;

export default class Player {
  acceleration: number;
  initial_velocity: number;
  initial_position: number;
  last_timestamp: number;

  constructor() {
    this.acceleration = ACCELERATION;
    this.initial_velocity = 0;
    this.initial_position = 0;
    this.last_timestamp = 0;
  }

  jump(time: number) {
    this.initial_position = this.getposition(time);
    this.initial_velocity = JUMP_VELOCITY;
    this.last_timestamp = time;
  }

  reset() {
    this.initial_velocity = 0;
    this.initial_position = 0;

    this.last_timestamp = 0;
  }

  getposition(time: number) {
    const t = time - this.last_timestamp;

    return (
      this.initial_position +
      this.initial_velocity * t +
      0.5 * this.acceleration * t ** 2
    );
  }
}
