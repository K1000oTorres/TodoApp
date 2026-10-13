import { screen, waitFor } from "@testing-library/react";
import LZString from "lz-string";
import toast, { Toaster } from "react-hot-toast";
import { defaultUser } from "../../../constants/defaultUser";
import { renderWithProviders } from "../../../test/renderWithProviders";
import type { Category, Task } from "../../../types/user";
import { ShareDialog } from "../ShareDialog";

const category: Category = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Work",
  emoji: "1f3e2",
  color: "#248eff",
};

const task: Task = {
  id: "11111111-1111-4111-8111-111111111111",
  done: false,
  pinned: false,
  name: "Write report",
  description: "Quarterly numbers",
  emoji: "1f4dd",
  color: "#ff8800",
  date: new Date("2025-01-02T10:00:00.000Z"),
  deadline: new Date("2025-02-03T12:00:00.000Z"),
  category: [category],
  sharedBy: "Someone else",
};

const renderDialog = (options: Parameters<typeof renderWithProviders>[1] = {}) =>
  renderWithProviders(
    <>
      <ShareDialog open onClose={vi.fn()} selectedTask={task} />
      <Toaster />
    </>,
    options,
  );

const getLink = () => (screen.getByLabelText("Shareable Link") as HTMLInputElement).value;

const decodePayload = (link: string) => {
  const params = new URL(link).searchParams;
  const json = LZString.decompressFromEncodedURIComponent(params.get("task") ?? "");
  return { payload: JSON.parse(json), userName: params.get("userName") };
};

describe("ShareDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "share");
    toast.remove();
  });

  it("shows a share link with the compressed task and the sender name", () => {
    renderDialog({ initialUser: { name: "Ada Lovelace" } });

    const link = getLink();
    expect(new URL(link).pathname).toBe("/share");
    expect(decodePayload(link).userName).toBe("Ada Lovelace");
  });

  it("falls back to 'User' when the sender has no name", () => {
    renderDialog({ initialUser: { name: null } });

    expect(decodePayload(getLink()).userName).toBe("User");
  });

  it("encodes the task so that it decodes back without its id and sender", () => {
    renderDialog();

    const { payload } = decodePayload(getLink());
    expect(payload).toEqual({
      done: false,
      pinned: false,
      name: "Write report",
      description: "Quarterly numbers",
      emoji: "1f4dd",
      color: "#ff8800",
      date: "2025-01-02T10:00:00.000Z",
      deadline: "2025-02-03T12:00:00.000Z",
      category: [category],
    });
  });

  it("drops the categories from the payload when categories are disabled", () => {
    renderDialog({
      initialUser: {
        settings: { ...defaultUser.settings, enableCategories: false },
      },
    });

    expect(decodePayload(getLink()).payload).not.toHaveProperty("category");
  });

  it("copies the link to the clipboard", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe(getLink());
    });
  });

  it("shows an error toast and does not crash when the clipboard rejects", async () => {
    const { user } = renderDialog();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: /copy/i }));

    expect(await screen.findByText("Error copying link to clipboard")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
    expect(screen.getByLabelText("Shareable Link")).toBeInTheDocument();
  });

  it("shares the link through navigator.share when it is available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const { user } = renderDialog();

    await user.click(screen.getByRole("button", { name: /^share$/i }));

    expect(share).toHaveBeenCalledWith({
      title: "Share Task",
      text: "Check out this task: Write report",
      url: getLink(),
    });
  });
});
