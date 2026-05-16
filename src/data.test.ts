import {
  giveUpProject,
  joinProject,
  loadCurrentProjectId,
  loadIdentity,
  loadProjectCards,
  loadProjectDetails,
  proposeProject,
  saveIdentity,
  updateDisplayName,
} from "./data";
import type { Identity } from "./types";

const identity: Identity = {
  clientId: "participant-1",
  displayName: "Ada",
};

describe("data store", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: jest.fn(() => "00000000-0000-4000-8000-000000000002"),
      },
    });
  });

  it("saves and loads a trimmed identity", () => {
    const savedIdentity = saveIdentity("  Ada Lovelace  ");

    expect(savedIdentity).toEqual({
      clientId: "00000000-0000-4000-8000-000000000002",
      displayName: "Ada Lovelace",
    });
    expect(loadIdentity()).toEqual(savedIdentity);
  });

  it("loads approved project cards from the seed data", () => {
    const cards = loadProjectCards(identity);

    expect(cards).toHaveLength(10);
    expect(cards[0]).toMatchObject({
      id: "ai-review-bot",
      title: "AI Pull Request Review Bot",
      signupCount: 0,
      participantNamesPreview: [],
      isSignedUp: false,
    });
  });

  it("keeps one active signup when joining a different project", () => {
    joinProject(identity, "ai-review-bot");
    expect(loadCurrentProjectId(identity)).toBe("ai-review-bot");

    joinProject(identity, "docs-chat");

    expect(loadCurrentProjectId(identity)).toBe("docs-chat");
    expect(loadProjectDetails("ai-review-bot", identity)?.participantNames).toEqual([]);
    expect(loadProjectDetails("docs-chat", identity)).toMatchObject({
      signupCount: 1,
      participantNames: ["Ada"],
      isSignedUp: true,
    });
  });

  it("removes the current signup when giving up a project", () => {
    joinProject(identity, "ai-review-bot");
    giveUpProject(identity);

    expect(loadCurrentProjectId(identity)).toBeNull();
    expect(loadProjectDetails("ai-review-bot", identity)?.signupCount).toBe(0);
  });

  it("keeps pending proposals out of approved project cards", () => {
    const proposal = proposeProject("  New AI Tool  ", "  A useful project idea.  ");
    const cards = loadProjectCards(identity);

    expect(proposal).toMatchObject({
      title: "New AI Tool",
      shortDescription: "A useful project idea.",
      status: "pending",
    });
    expect(cards.some((card) => card.id === proposal.id)).toBe(false);
    expect(loadProjectDetails(proposal.id, identity)).toBeNull();
  });

  it("updates signup display names when the participant renames themselves", () => {
    joinProject(identity, "docs-chat");
    const updatedIdentity = updateDisplayName(identity, "  Ada Byron  ");

    expect(updatedIdentity.displayName).toBe("Ada Byron");
    expect(loadProjectDetails("docs-chat", updatedIdentity)?.participantNames).toEqual([
      "Ada Byron",
    ]);
  });
});
