type callback<T extends any[]> = (...args: T) => void;

class Connection<T> {
  private readonly array: T[];
  private readonly value: T;

  constructor(array: T[], value: T) {
    this.array = array;
    this.value = value;
  }

  Disconnect() {
    const index = this.array.indexOf(this.value);

    if (index > -1) {
      this.array.splice(index, 1);
    }
  }
}

export default class Event<T extends any[]> {
  private readonly connections: callback<T>[];

  constructor() {
    this.connections = [];
  }

  Connect(callback: callback<T>) {
    this.connections.push(callback);
    return new Connection<callback<T>>(this.connections, callback);
  }

  Emit(...args: T) {
    for (const conn of this.connections) {
      try {
        conn(...args);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
