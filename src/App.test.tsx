import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";

const cardFixtures = [
  {
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "AI Pull Request Review Bot",
    shortDescription:
      "Build an assistant that summarizes code changes and flags risky diffs before review.",
    signupCount: 6,
    participantNamesPreview: [
      "Grace Hopper",
      "Ada Lovelace",
      "Linus Torvalds",
      "Margaret Hamilton",
      "Barbara Liskov",
    ],
    isSignedUp: true,
  },
  {
    projectId: "22222222-2222-4222-8222-222222222222",
    title: "Meeting Notes to GitHub Issues",
    shortDescription: "Turn transcript snippets into scoped engineering issues.",
    signupCount: 0,
    participantNamesPreview: [],
    isSignedUp: false,
  },
  {
    projectId: "33333333-3333-4333-8333-333333333333",
    title: "Edge Case Test Generator",
    shortDescription: "Analyze functions and propose high-signal unit tests.",
    signupCount: 0,
    participantNamesPreview: [],
    isSignedUp: false,
  },
  {
    projectId: "44444444-4444-4444-8444-444444444444",
    title: "Internal Docs Chat",
    shortDescription: "Prototype a retrieval assistant for internal docs.",
    signupCount: 0,
    participantNamesPreview: [],
    isSignedUp: false,
  },
  {
    projectId: "55555555-5555-4555-8555-555555555555",
    title: "Bug Reproduction Agent",
    shortDescription: "Turn bug reports into reproducible scripts.",
    signupCount: 0,
    participantNamesPreview: [],
    isSignedUp: false,
  },
  {
    projectId: "66666666-6666-4666-8666-666666666666",
    title: "Design Prompt to UI",
    shortDescription: "Generate accessible React component drafts.",
    signupCount: 0,
    participantNamesPreview: [],
    isSignedUp: false,
  },
  {
    projectId: "77777777-7777-4777-8777-777777777777",
    title: "SQL Query Explainer",
    shortDescription: "Explain complex SQL and suggest safer alternatives.",
    signupCount: 0,
    participantNamesPreview: [],
    isSignedUp: false,
  },
];

const detailsFixtures: Record<string, { title: string; shortDescription: string; participants: string[] }> = {
  "11111111-1111-4111-8111-111111111111": {
    title: "AI Pull Request Review Bot",
    shortDescription:
      "Build an assistant that summarizes code changes and flags risky diffs before review.",
    participants: ["Grace Hopper", "Ada Lovelace"],
  },
};

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

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

    globalThis.fetch = jest.fn((input) => {
      const url = String(input);

      if (url.includes("/api/projects/cards")) {
        const parsedUrl = new URL(url);
        const limit = Number(parsedUrl.searchParams.get("limit") ?? "6");
        const offset = Number(parsedUrl.searchParams.get("offset") ?? "0");
        const items = cardFixtures.slice(offset, offset + limit);

        return mockJsonResponse(200, {
          items,
          limit,
          offset,
          hasMore: offset + limit < cardFixtures.length,
        });
      }

      if (url.endsWith("/api/participants/bootstrap")) {
        return mockJsonResponse(200, {
          participantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          displayName: "Grace Hopper",
          clientId: "00000000-0000-4000-8000-000000000001",
        });
      }

      if (url.endsWith("/api/projects")) {
        return mockJsonResponse(201, {
          projectId: "88888888-8888-4888-8888-888888888888",
          title: "Agentic post-mortem helper",
          shortDescription: "Summarize incidents and suggest follow-up actions.",
          status: "pending",
        });
      }

      if (url.endsWith("/api/signups/join") || url.endsWith("/api/signups/switch")) {
        return mockJsonResponse(200, {
          participantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          projectId: "11111111-1111-4111-8111-111111111111",
        });
      }

      if (url.endsWith("/api/signups")) {
        return mockJsonResponse(200, {
          participantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          deleted: true,
        });
      }

      if (url.includes("/api/projects/")) {
        const projectId = url.split("/api/projects/")[1];
        const details = detailsFixtures[projectId];

        if (!details) {
          return mockJsonResponse(404, { error: "Project not found" });
        }

        return mockJsonResponse(200, {
          projectId,
          title: details.title,
          shortDescription: details.shortDescription,
          participants: details.participants,
        });
      }

      return mockJsonResponse(404, { error: "Not found" });
    }) as jest.Mock;
  });

  async function waitForInitialProjectsLoad() {
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  }

  it("renders the onboarding screen on first visit", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /what should other participants call you/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start browsing/i })).toBeInTheDocument();
  });

  it("stores a display name and shows the project board after onboarding", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Grace Hopper" } });
    fireEvent.click(screen.getByRole("button", { name: /start browsing/i }));

    expect(await screen.findByRole("heading", { name: /pick one project to work on/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Grace Hopper")).toBeInTheDocument();
    expect(localStorage.getItem("hackathon.identity")).toContain("Grace Hopper");
  });

  it("persists name prompt identity values in localStorage", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: /start browsing/i }));

    expect(JSON.parse(localStorage.getItem("hackathon.identity") as string)).toEqual({
      clientId: "00000000-0000-4000-8000-000000000001",
      displayName: "Ada Lovelace",
    });
    await waitForInitialProjectsLoad();
  });

  it("renders project cards with fields and participant chips", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    render(<App />);
    await waitForInitialProjectsLoad();

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
    await waitForInitialProjectsLoad();

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
    window.history.pushState({}, "", "/project/11111111-1111-4111-8111-111111111111");

    render(<App />);
    await waitForInitialProjectsLoad();

    expect(await screen.findByText("Project Details")).toBeInTheDocument();
    expect(await screen.findAllByText("AI Pull Request Review Bot")).toHaveLength(2);
  });

  it("shows an empty project list state when no approved projects exist", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    (globalThis.fetch as jest.Mock).mockImplementationOnce(() =>
      mockJsonResponse(200, {
        items: [],
        limit: 6,
        offset: 0,
        hasMore: false,
      }),
    );

    render(<App />);
    await waitForInitialProjectsLoad();

    expect(await screen.findByRole("heading", { name: /no approved projects yet/i })).toBeInTheDocument();
  });

  it("renders the proposal form from the propose route", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    window.history.pushState({}, "", "/propose");

    render(<App />);
    await waitForInitialProjectsLoad();

    expect(screen.getByRole("heading", { name: /suggest a new project/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit for review/i })).toBeInTheDocument();
  });

  it("renders a not found view for unknown routes", async () => {
    localStorage.setItem(
      "hackathon.identity",
      JSON.stringify({ clientId: "participant-1", displayName: "Grace Hopper" }),
    );
    window.history.pushState({}, "", "/unknown");

    render(<App />);
    await waitForInitialProjectsLoad();

    expect(screen.getByRole("heading", { name: /that page does not exist/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to project board/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
