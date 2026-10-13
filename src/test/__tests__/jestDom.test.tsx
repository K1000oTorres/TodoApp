import { render, screen } from "@testing-library/react";

function Greeting({ name }: { name: string }) {
  return (
    <section>
      <h1>Hello, {name}</h1>
      <button disabled>Save</button>
    </section>
  );
}

describe("jest-dom matchers", () => {
  it("asserts presence and text content of rendered elements", () => {
    render(<Greeting name="Ada" />);

    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent("Hello, Ada");
  });

  it("asserts element state", () => {
    render(<Greeting name="Grace" />);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });
});

describe("DOM cleanup between tests", () => {
  it("renders a component", () => {
    render(<Greeting name="First" />);

    expect(screen.getByText("Hello, First")).toBeInTheDocument();
  });

  it("does not see nodes rendered by the previous test", () => {
    expect(screen.queryByText("Hello, First")).not.toBeInTheDocument();
    expect(document.body.querySelector("section")).toBeNull();
  });
});
