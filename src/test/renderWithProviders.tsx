import type { ReactElement, ReactNode } from "react";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material";
import {
  render,
  renderHook,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { defaultUser } from "../constants/defaultUser";
import { TaskProvider } from "../contexts/TaskProvider";
import { UserContextProvider } from "../contexts/UserProvider";
import { Themes, createCustomTheme } from "../theme/createTheme";
import type { User } from "../types/user";

export interface ProviderOptions {
  /** Initial entry of the `MemoryRouter`. Defaults to `"/"`. */
  route?: string;
  /** Merged over `defaultUser` and seeded to `localStorage["user"]`. */
  initialUser?: Partial<User>;
  /** Palette mode of the MUI and Emotion themes. Defaults to `"dark"`. */
  themeMode?: "light" | "dark";
}

/**
 * Builds the provider tree used by the app (`src/main.tsx` and `src/App.tsx`):
 * MemoryRouter > UserContextProvider > TaskProvider > MuiThemeProvider > EmotionThemeProvider.
 */
export function createWrapper({
  route = "/",
  initialUser,
  themeMode = "dark",
}: ProviderOptions = {}) {
  // UserContextProvider reads its initial state from localStorage via useStorageState.
  if (initialUser) {
    localStorage.setItem("user", JSON.stringify({ ...defaultUser, ...initialUser }));
  }

  const primary = Themes[0].MuiTheme.palette.primary.main;
  const secondary = Themes[0].MuiTheme.palette.secondary.main;
  const muiTheme = createCustomTheme(primary, secondary, themeMode);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <UserContextProvider>
          <TaskProvider>
            <MuiThemeProvider theme={muiTheme}>
              <EmotionThemeProvider
                theme={{
                  primary,
                  secondary,
                  darkmode: themeMode === "dark",
                  mui: muiTheme,
                  // keeps animations deterministic in tests
                  reduceMotion: "on",
                }}
              >
                {children}
              </EmotionThemeProvider>
            </MuiThemeProvider>
          </TaskProvider>
        </UserContextProvider>
      </MemoryRouter>
    );
  };
}

/** Renders `ui` inside the app providers and returns a ready `userEvent` instance. */
export function renderWithProviders(
  ui: ReactElement,
  {
    route,
    initialUser,
    themeMode,
    ...renderOptions
  }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderResult & { user: UserEvent } {
  const wrapper = createWrapper({ route, initialUser, themeMode });
  return { user: userEvent.setup(), ...render(ui, { wrapper, ...renderOptions }) };
}

/** Renders a hook inside the app providers. */
export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options: ProviderOptions = {},
): RenderHookResult<Result, Props> {
  return renderHook(hook, { wrapper: createWrapper(options) });
}
