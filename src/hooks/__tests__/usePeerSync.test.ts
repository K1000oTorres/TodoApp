import { useContext } from "react";
import { act, waitFor } from "@testing-library/react";
import { UserContext } from "../../contexts/UserContext";
import { FakeDataConnection, FakePeer } from "../../test/fakePeer";
import { renderHookWithProviders } from "../../test/renderWithProviders";
import type { Category, Task, User, UUID } from "../../types/user";
import { compressSyncData, decompressSyncData, prepareSyncData } from "../../utils/syncUtils";
import { usePeerSync } from "../usePeerSync";

vi.mock("peerjs", async () => {
  const { FakePeer } = await import("../../test/fakePeer");
  return { default: FakePeer };
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as UUID;

const makeTask = (n: number, overrides: Partial<Task> = {}): Task => ({
  id: uuid(n),
  done: false,
  pinned: false,
  name: `Task ${n}`,
  color: "#000000",
  date: new Date(`2024-01-0${n}T10:00:00.000Z`),
  ...overrides,
});

const remotePayload = (tasks: Task[], categories: Category[] = []) =>
  compressSyncData(prepareSyncData(tasks, [], categories, [], []));

const renderSync = (initialUser: Partial<User> = {}) =>
  renderHookWithProviders(() => ({ sync: usePeerSync(), user: useContext(UserContext).user }), {
    initialUser: { tasks: [makeTask(1)], ...initialUser },
  });

const lastConnection = (): FakeDataConnection => FakePeer.last.connections.at(-1)!;

describe("usePeerSync", () => {
  beforeEach(() => {
    FakePeer.reset();
  });

  describe("host", () => {
    it("starts a peer and shows the peer id once it is open", () => {
      const { result } = renderSync();

      act(() => result.current.sync.startHost());
      expect(result.current.sync.syncStatus).toEqual({
        message: "Starting Peer...",
        severity: "info",
      });

      act(() => FakePeer.last.emit("open", "host-id"));

      expect(result.current.sync.hostPeerId).toBe("host-id");
      expect(result.current.sync.syncStatus).toEqual({
        message: "Waiting for device to connect...",
        severity: "info",
      });
    });

    it("reports when a device connects", () => {
      const { result } = renderSync();
      act(() => result.current.sync.startHost());

      act(() => FakePeer.last.emit("connection", new FakeDataConnection("guest-id")));

      expect(result.current.sync.syncStatus).toEqual({
        message: "Device connected, exchanging data...",
        severity: "info",
      });
    });

    it("merges received tasks and sends the merged data back to the guest", async () => {
      const { result } = renderSync();
      act(() => result.current.sync.startHost());
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      await act(async () => {
        connection.emit("data", remotePayload([makeTask(2)]));
      });

      await waitFor(() => expect(result.current.sync.syncStatus.severity).toBe("success"));
      expect(result.current.sync.syncStatus.message).toBe("Data synchronized successfully!");
      expect(result.current.user.tasks.map((t) => t.name)).toEqual(["Task 1", "Task 2"]);
      expect(result.current.user.lastSyncedAt).toBeDefined();

      expect(connection.send).toHaveBeenCalledTimes(1);
      const sent = decompressSyncData(connection.send.mock.calls[0][0]);
      expect(sent?.tasks.map((t) => t.name)).toEqual(["Task 1", "Task 2"]);
    });

    it("sends the host's other data back when it is the chosen source", async () => {
      const { result } = renderSync({ name: "Host" });
      act(() => result.current.sync.startHost());
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      await act(async () => {
        connection.emit("data", remotePayload([]));
      });

      await waitFor(() => expect(connection.send).toHaveBeenCalled());
      const sent = decompressSyncData(connection.send.mock.calls[0][0]);
      expect(sent?.otherData?.name).toBe("Host");
      expect(sent?.otherDataSource).toBe("this_device");
      expect(result.current.sync.otherDataSource).toBe("this_device");
    });

    it("does not send other data back when the user chose not to sync it", async () => {
      const { result } = renderSync({ name: "Host" });
      act(() => result.current.sync.startHost());
      act(() => result.current.sync.setOtherDataSyncOption("no_sync"));
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      await act(async () => {
        connection.emit("data", remotePayload([]));
      });

      await waitFor(() => expect(connection.send).toHaveBeenCalled());
      const sent = decompressSyncData(connection.send.mock.calls[0][0]);
      expect(sent).not.toHaveProperty("otherData");
      expect(sent?.otherDataSource).toBe("no_sync");
    });

    it("reports an error and keeps local tasks when the received data is invalid", async () => {
      const { result } = renderSync();
      act(() => result.current.sync.startHost());
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      await act(async () => {
        connection.emit("data", "not-a-valid-payload");
      });

      await waitFor(() =>
        expect(result.current.sync.syncStatus).toEqual({
          message: "Failed to sync data",
          severity: "error",
        }),
      );
      expect(result.current.user.tasks.map((t) => t.name)).toEqual(["Task 1"]);
      expect(connection.send).not.toHaveBeenCalled();
    });

    it("reports a peer error", () => {
      const { result } = renderSync();
      act(() => result.current.sync.startHost());

      act(() => FakePeer.last.emit("error", new Error("boom")));

      expect(result.current.sync.syncStatus).toEqual({ message: "Peer error.", severity: "error" });
    });

    it("reports a connection error", () => {
      const { result } = renderSync();
      act(() => result.current.sync.startHost());
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      act(() => connection.emit("error", new Error("boom")));

      expect(result.current.sync.syncStatus).toEqual({
        message: "Connection error.",
        severity: "error",
      });
    });

    it("resets the sync state when the guest closes the connection", () => {
      const { result } = renderSync();
      act(() => {
        result.current.sync.setMode("display");
        result.current.sync.startHost();
      });
      act(() => FakePeer.last.emit("open", "host-id"));
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      act(() => connection.emit("close"));

      expect(result.current.sync.mode).toBeNull();
      expect(result.current.sync.hostPeerId).toBe("");
    });
  });

  describe("guest", () => {
    it("connects to the host once its own peer is open", () => {
      const { result } = renderSync();

      act(() => result.current.sync.connectToHost("host-id"));
      expect(result.current.sync.syncStatus.message).toBe("Starting Peer...");

      act(() => FakePeer.last.emit("open", "guest-id"));

      expect(FakePeer.last.connect).toHaveBeenCalledWith("host-id");
      expect(result.current.sync.syncStatus).toEqual({
        message: "Connecting to host...",
        severity: "info",
      });
    });

    it("sends its data to the host when the connection opens", async () => {
      const { result } = renderSync();
      act(() => result.current.sync.connectToHost("host-id"));
      act(() => FakePeer.last.emit("open", "guest-id"));
      const connection = lastConnection();

      await act(async () => {
        connection.emit("open");
      });

      await waitFor(() => expect(connection.send).toHaveBeenCalledTimes(1));
      expect(result.current.sync.syncStatus.message).toBe("Connected, sending your data...");
      const sent = decompressSyncData(connection.send.mock.calls[0][0]);
      expect(sent?.tasks.map((t) => t.name)).toEqual(["Task 1"]);
    });

    it("merges the data returned by the host and reports success", async () => {
      const { result } = renderSync();
      act(() => result.current.sync.connectToHost("host-id"));
      act(() => FakePeer.last.emit("open", "guest-id"));
      const connection = lastConnection();
      await act(async () => {
        connection.emit("open");
      });
      await waitFor(() => expect(connection.send).toHaveBeenCalled());

      await act(async () => {
        connection.emit("data", remotePayload([makeTask(1), makeTask(2)]));
      });

      await waitFor(() => expect(result.current.sync.syncStatus.severity).toBe("success"));
      expect(result.current.user.tasks.map((t) => t.name)).toEqual(["Task 1", "Task 2"]);
      expect(result.current.user.lastSyncedAt).toBeDefined();
    });

    it("reports a peer error", () => {
      const { result } = renderSync();
      act(() => result.current.sync.connectToHost("host-id"));

      act(() => FakePeer.last.emit("error", new Error("boom")));

      expect(result.current.sync.syncStatus).toEqual({ message: "Peer error.", severity: "error" });
    });

    it("reports a connection error when the host cannot be reached", () => {
      const { result } = renderSync();
      act(() => result.current.sync.connectToHost("host-id"));
      act(() => FakePeer.last.emit("open", "guest-id"));

      act(() => lastConnection().emit("error", new Error("boom")));

      expect(result.current.sync.syncStatus).toEqual({
        message: "Connection error.",
        severity: "error",
      });
    });
  });

  describe("resetAll", () => {
    it("closes the connection, destroys the peer and clears the sync state", () => {
      const { result } = renderSync();
      act(() => {
        result.current.sync.setMode("display");
        result.current.sync.startHost();
      });
      act(() => FakePeer.last.emit("open", "host-id"));
      act(() => result.current.sync.setOtherDataSyncOption("no_sync"));
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      act(() => result.current.sync.resetAll());

      expect(connection.close).toHaveBeenCalled();
      expect(FakePeer.last.destroy).toHaveBeenCalled();
      expect(result.current.sync.mode).toBeNull();
      expect(result.current.sync.hostPeerId).toBe("");
      expect(result.current.sync.syncStatus).toEqual({ message: "", severity: "info" });
      expect(result.current.sync.otherDataSyncOption).toBe("this_device");
    });
  });

  describe("cleanup", () => {
    it("destroys the host peer when the guest closes the connection", () => {
      const { result } = renderSync();
      act(() => result.current.sync.startHost());
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      act(() => connection.emit("close"));

      expect(FakePeer.last.destroy).toHaveBeenCalled();
    });

    it("destroys the guest peer when the host closes the connection", async () => {
      const { result } = renderSync();
      act(() => result.current.sync.connectToHost("host-id"));
      act(() => FakePeer.last.emit("open", "guest-id"));
      const connection = lastConnection();
      await act(async () => {
        connection.emit("open");
      });
      await waitFor(() => expect(connection.send).toHaveBeenCalled());

      act(() => connection.emit("close"));

      expect(FakePeer.last.destroy).toHaveBeenCalled();
    });

    it("destroys the peer and closes the connection when the component using the hook unmounts", () => {
      const { result, unmount } = renderSync();
      act(() => result.current.sync.startHost());
      const connection = new FakeDataConnection("guest-id");
      act(() => FakePeer.last.emit("connection", connection));

      unmount();

      expect(connection.close).toHaveBeenCalled();
      expect(FakePeer.last.destroy).toHaveBeenCalled();
    });
  });
});
