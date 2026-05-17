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

  it("renders project details from the project route", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    window.history.pushState({}, "", "/project/ai-review-bot");

    render(<App />);

    expect(await screen.findByText("Project Details")).toBeInTheDocument();
    expect(await screen.findAllByText("AI Pull Request Review Bot")).toHaveLength(2);
  });

  it("shows an empty project list state when no approved projects exist", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    localStorage.setItem(
      "hackathon.projects",
      JSON.stringify([
        {
          id: "pending-only-project",
          title: "Pending review",
          shortDescription: "Not visible on board",
          status: "pending",
          createdAt: "2026-05-16T07:00:00.000Z",
        },
      ]),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: /no approved projects yet/i })).toBeInTheDocument();
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
