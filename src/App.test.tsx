import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
      },
    });
  });

  it("renders the onboarding screen on first visit", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /what should other participants call you/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start browsing/i })).toBeInTheDocument();
  });

  it("stores a display name and shows the project board after onboarding", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Grace Hopper" } });
    fireEvent.click(screen.getByRole("button", { name: /start browsing/i }));

    expect(
      screen.getByRole("heading", { name: /pick one project to work on/i }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Grace Hopper")).toBeInTheDocument();
    expect(localStorage.getItem("hackathon.identity")).toContain("Grace Hopper");
  });

  it("renders project details from the project route", () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    window.history.pushState({}, "", "/project/ai-review-bot");

    render(<App />);

    expect(screen.getByText("Project Details")).toBeInTheDocument();
    expect(screen.getAllByText("AI Pull Request Review Bot")).toHaveLength(2);
  });

  it("renders the proposal form from the propose route", () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    window.history.pushState({}, "", "/propose");

    render(<App />);

    expect(screen.getByRole("heading", { name: /suggest a new project/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit for review/i })).toBeInTheDocument();
  });

  it("renders a not found view for unknown routes", () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    window.history.pushState({}, "", "/unknown");

    render(<App />);

    expect(screen.getByRole("heading", { name: /that page does not exist/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to project board/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
