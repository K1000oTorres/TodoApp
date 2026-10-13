// A static import is evaluated during collection, before any `beforeEach` hook runs.
// `Sidebar.tsx` reads `window.matchMedia` at module load, so this only works when the
// stub is installed at the top level of the setup file.
import { ProfileSidebar } from "../../components/Sidebar";

// Captured during collection, before `beforeEach` replaces the stub, so it still
// holds the calls made while `Sidebar.tsx` was being imported.
const importTimeMatchMedia = vi.mocked(window.matchMedia);

describe("import-time matchMedia", () => {
  it("loads modules that read matchMedia while being imported", () => {
    expect(typeof ProfileSidebar).toBe("function");
    expect(importTimeMatchMedia).toHaveBeenCalledWith("(display-mode: standalone)");
  });

  it("keeps the stub available after the import", () => {
    expect(window.matchMedia("(display-mode: standalone)").matches).toBe(false);
  });
});
