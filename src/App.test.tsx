import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("persists name prompt identity values in localStorage", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: /start browsing/i }));

    expect(JSON.parse(localStorage.getItem("hackathon.identity") as string)).toEqual({
      clientId: "00000000-0000-4000-8000-000000000001",
      displayName: "Ada Lovelace",
    });
  });

  it("renders project cards with fields and participant chips", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    localStorage.setItem(
      "hackathon.signups",
      JSON.stringify([
        {
          clientId: "participant-1",
          displayName: "Grace Hopper",
          projectId: "ai-review-bot",
          joinedAt: "2026-05-16T07:00:01.000Z",
        },
        {
          clientId: "participant-2",
          displayName: "Ada Lovelace",
          projectId: "ai-review-bot",
          joinedAt: "2026-05-16T07:00:02.000Z",
        },
        {
          clientId: "participant-3",
          displayName: "Linus Torvalds",
          projectId: "ai-review-bot",
          joinedAt: "2026-05-16T07:00:03.000Z",
        },
        {
          clientId: "participant-4",
          displayName: "Margaret Hamilton",
          projectId: "ai-review-bot",
          joinedAt: "2026-05-16T07:00:04.000Z",
        },
        {
          clientId: "participant-5",
          displayName: "Barbara Liskov",
          projectId: "ai-review-bot",
          joinedAt: "2026-05-16T07:00:05.000Z",
        },
        {
          clientId: "participant-6",
          displayName: "Donald Knuth",
          projectId: "ai-review-bot",
          joinedAt: "2026-05-16T07:00:06.000Z",
        },
      ]),
    );

    render(<App />);

    const card = await screen.findByLabelText(/ai pull request review bot, 6 participants/i);
    expect(within(card).getByText("AI Pull Request Review Bot")).toBeInTheDocument();
    expect(
      within(card).getByText(/build an assistant that summarizes code changes and flags risky diffs/i),
    ).toBeInTheDocument();
    expect(within(card).getByText("6 signed up")).toBeInTheDocument();
    expect(within(card).getByText("Grace Hopper")).toBeInTheDocument();
    expect(within(card).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(card).getByText("Linus Torvalds")).toBeInTheDocument();
    expect(within(card).getByText("Margaret Hamilton")).toBeInTheDocument();
    expect(within(card).getByText("Barbara Liskov")).toBeInTheDocument();
    expect(within(card).getByText("+1 more")).toBeInTheDocument();
  });

  it("appends additional projects when infinite scroll load-more is used", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );

    render(<App />);

    await screen.findByText("AI Pull Request Review Bot");
    expect(screen.queryByText("SQL Query Explainer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load more projects/i }));

    expect(await screen.findByText("SQL Query Explainer")).toBeInTheDocument();
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
