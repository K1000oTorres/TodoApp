import { vi } from "vitest";

type Listener = (...args: unknown[]) => void;

class Emitter {
  private listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  /** Fires every listener registered for `event`, the way PeerJS would. */
  emit(event: string, ...args: unknown[]) {
    (this.listeners.get(event) ?? []).forEach((listener) => listener(...args));
  }
}

/**
 * Controllable stand-in for a PeerJS `DataConnection`.
 * Tests drive it with `emit("open" | "data" | "error" | "close", ...)`.
 */
export class FakeDataConnection extends Emitter {
  send = vi.fn();
  close = vi.fn();
  constructor(public peer: string) {
    super();
  }
}

/**
 * Controllable stand-in for the PeerJS `Peer` class.
 * Use it through `vi.mock("peerjs")`; every constructed instance is tracked in `FakePeer.instances`.
 */
export class FakePeer extends Emitter {
  static instances: FakePeer[] = [];

  static reset() {
    FakePeer.instances = [];
  }

  static get last(): FakePeer {
    const peer = FakePeer.instances.at(-1);
    if (!peer) throw new Error("No Peer was created");
    return peer;
  }

  connections: FakeDataConnection[] = [];
  destroy = vi.fn();
  connect = vi.fn((id: string) => {
    const connection = new FakeDataConnection(id);
    this.connections.push(connection);
    return connection;
  });

  constructor() {
    super();
    FakePeer.instances.push(this);
  }
}
