import { mockMatchMedia } from "../../test/browserMocks";
import { renderHookWithProviders } from "../../test/renderWithProviders";
import { useSystemTheme } from "../useSystemTheme";

describe("useSystemTheme", () => {
  it("returns dark when the system prefers a dark color scheme", () => {
    mockMatchMedia(true);

    const { result } = renderHookWithProviders(() => useSystemTheme());

    expect(result.current).toBe("dark");
  });

  it("returns light when the system does not prefer a dark color scheme", () => {
    mockMatchMedia(false);

    const { result } = renderHookWithProviders(() => useSystemTheme());

    expect(result.current).toBe("light");
  });
});
