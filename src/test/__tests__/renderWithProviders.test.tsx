import { useContext } from "react";
import { useTheme } from "@mui/material";
import { useTheme as useEmotionTheme } from "@emotion/react";
import { useLocation } from "react-router-dom";
import { screen } from "@testing-library/react";
import { UserContext } from "../../contexts/UserContext";
import { renderHookWithProviders, renderWithProviders } from "../renderWithProviders";

function Probe() {
  const { user } = useContext(UserContext);
  const { pathname } = useLocation();
  const muiTheme = useTheme();
  const emotionTheme = useEmotionTheme();

  return (
    <dl>
      <dt>user</dt>
      <dd data-testid="user">{user.name ?? "anonymous"}</dd>
      <dt>path</dt>
      <dd data-testid="path">{pathname}</dd>
      <dt>mui</dt>
      <dd data-testid="mui-mode">{muiTheme.palette.mode}</dd>
      <dt>emotion</dt>
      <dd data-testid="emotion-dark">{String(emotionTheme.darkmode)}</dd>
      <dd data-testid="emotion-motion">{emotionTheme.reduceMotion}</dd>
    </dl>
  );
}

describe("renderWithProviders", () => {
  it("renders with the default providers", () => {
    renderWithProviders(<Probe />);

    expect(screen.getByTestId("user")).toHaveTextContent("anonymous");
    expect(screen.getByTestId("path")).toHaveTextContent("/");
    expect(screen.getByTestId("mui-mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("emotion-dark")).toHaveTextContent("true");
    expect(screen.getByTestId("emotion-motion")).toHaveTextContent("on");
  });

  it("starts at the requested route", () => {
    renderWithProviders(<Probe />, { route: "/settings" });

    expect(screen.getByTestId("path")).toHaveTextContent("/settings");
  });

  it("seeds the user context from initialUser", () => {
    renderWithProviders(<Probe />, { initialUser: { name: "Ada" } });

    expect(screen.getByTestId("user")).toHaveTextContent("Ada");
  });

  it("supports the light theme mode", () => {
    renderWithProviders(<Probe />, { themeMode: "light" });

    expect(screen.getByTestId("mui-mode")).toHaveTextContent("light");
    expect(screen.getByTestId("emotion-dark")).toHaveTextContent("false");
  });

  it("returns a userEvent instance that drives the rendered UI", async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(<button onClick={onClick}>Save</button>);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("renderHookWithProviders", () => {
  it("runs a hook inside the provider tree", () => {
    const { result } = renderHookWithProviders(() => useContext(UserContext).user.name, {
      initialUser: { name: "Grace" },
    });

    expect(result.current).toBe("Grace");
  });

  it("uses the route option", () => {
    const { result } = renderHookWithProviders(() => useLocation().pathname, {
      route: "/about",
    });

    expect(result.current).toBe("/about");
  });
});
