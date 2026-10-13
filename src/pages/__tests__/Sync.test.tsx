import { act, screen, waitFor } from "@testing-library/react";
import { FakeDataConnection, FakePeer } from "../../test/fakePeer";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { Task, UUID } from "../../types/user";
import { compressSyncData, prepareSyncData } from "../../utils/syncUtils";
import Sync from "../Sync";

vi.mock("peerjs", async () => {
  const { FakePeer } = await import("../../test/fakePeer");
  return { default: FakePeer };
});

// The QR image cannot be decoded in jsdom, so it exposes the encoded value as text instead.
vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>,
}));

// The camera is out of reach in jsdom, so the scanner is replaced by a button that "scans" a host id.
vi.mock("@yudiel/react-qr-scanner", () => ({
  Scanner: ({ onScan }: { onScan: (result: { rawValue: string }[]) => void }) => (
    <button onClick={() => onScan([{ rawValue: " host-id " }])}>Simulate scan</button>
  ),
}));

const makeTask = (n: number): Task => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as UUID,
  done: false,
  pinned: false,
  name: `Task ${n}`,
  color: "#000000",
  date: new Date(`2024-01-0${n}T10:00:00.000Z`),
});

const remotePayload = (tasks: Task[]) => compressSyncData(prepareSyncData(tasks, [], [], [], []));

describe("Sync page", () => {
  beforeEach(() => {
    FakePeer.reset();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers both sync modes while online", () => {
    renderWithProviders(<Sync />);

    expect(screen.getByRole("button", { name: "Display QR Code" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Scan QR Code" })).toBeEnabled();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("warns and disables both modes while offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    renderWithProviders(<Sync />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Display QR Code" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Scan QR Code" })).toBeDisabled();
  });

  it("shows the QR code, receives the guest's data and completes the sync as host", async () => {
    const { user } = renderWithProviders(<Sync />, {
      initialUser: { tasks: [makeTask(1)] },
    });

    await user.click(screen.getByRole("button", { name: "Display QR Code" }));
    expect(screen.getByText("Host Mode")).toBeInTheDocument();
    expect(screen.getByText("Initializing...")).toBeInTheDocument();

    act(() => FakePeer.last.emit("open", "host-id"));
    expect(
      screen.getByText("Scan this QR code with another device to sync data"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("qr-code")).toHaveTextContent("host-id");
    expect(screen.getByText("Waiting for device to connect...")).toBeInTheDocument();

    const connection = new FakeDataConnection("guest-id");
    act(() => FakePeer.last.emit("connection", connection));
    expect(screen.getByText("Device connected, exchanging data...")).toBeInTheDocument();

    await act(async () => {
      connection.emit("data", remotePayload([makeTask(2)]));
    });

    expect(await screen.findByText("Sync Complete")).toBeInTheDocument();
    expect(screen.getByText("Data synchronized successfully!")).toBeInTheDocument();
    expect(connection.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("user")!).tasks).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Display QR Code" })).toBeInTheDocument();
  });

  it("connects to the scanned host, sends its data and completes the sync as guest", async () => {
    const { user } = renderWithProviders(<Sync />, { initialUser: { tasks: [makeTask(1)] } });

    await user.click(screen.getByRole("button", { name: "Scan QR Code" }));
    await user.click(await screen.findByRole("button", { name: "Simulate scan" }));

    expect(screen.getByText("Scan Mode")).toBeInTheDocument();
    expect(screen.getByText("Starting Peer...")).toBeInTheDocument();

    act(() => FakePeer.last.emit("open", "guest-id"));
    expect(FakePeer.last.connect).toHaveBeenCalledWith("host-id");
    expect(screen.getAllByText("Connecting to host...").length).toBeGreaterThan(0);

    const connection = FakePeer.last.connections[0];
    await act(async () => {
      connection.emit("open");
    });
    await waitFor(() => expect(connection.send).toHaveBeenCalledTimes(1));

    await act(async () => {
      connection.emit("data", remotePayload([makeTask(1), makeTask(2)]));
    });

    expect(await screen.findByText("Sync Complete")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("user")!).tasks).toHaveLength(2);
  });

  it("shows the connection error and lets the user try again", async () => {
    const { user } = renderWithProviders(<Sync />);

    await user.click(screen.getByRole("button", { name: "Display QR Code" }));
    act(() => FakePeer.last.emit("open", "host-id"));
    act(() => FakePeer.last.emit("error", new Error("boom")));

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Peer error.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    expect(FakePeer.last.destroy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Display QR Code" })).toBeInTheDocument();
  });
});
