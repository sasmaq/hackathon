/** @jest-environment node */

import { app } from "./index";
import { sql } from "./db/client.js";
import { mirror } from "./db/sqlite/mirror.js";

jest.mock("@hono/node-server", () => ({
  serve: jest.fn(),
}));

jest.mock("./env.js", () => ({
  env: {
    port: 8787,
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    corsOrigins: ["http://localhost:5173"],
    adminSecret: "test-admin-secret",
    debugSqliteOnly: false,
    debugSqliteMirror: false,
    debugSqlitePath: "server/db/sqlite/debug-mirror.sqlite",
  },
}));

jest.mock("./db/client.js", () => ({
  sql: jest.fn(),
}));

jest.mock("./db/sqlite/mirror.js", () => ({
  mirror: {
    enabled: false,
    path: "server/db/sqlite/debug-mirror.sqlite",
    upsertParticipant: jest.fn(),
    upsertProject: jest.fn(),
    upsertSignup: jest.fn(),
    deleteSignup: jest.fn(),
    appendEvent: jest.fn(),
  },
  mirrorSafe: (action: string, operation: () => void) => {
    if (!(globalThis as { __MIRROR_ENABLED__?: boolean }).__MIRROR_ENABLED__) {
      return;
    }

    try {
      operation();
    } catch (error) {
      console.warn(`[sqlite-mirror] ${action} failed`, error);
    }
  },
}));

jest.mock("./db/sqlite/primary.js", () => ({
  sqlitePrimary: {
    findParticipantByClientId: jest.fn(),
    bootstrapParticipant: jest.fn(),
    getProjectStatus: jest.fn(),
    listApprovedProjectCards: jest.fn(),
    getApprovedProject: jest.fn(),
    getProjectParticipants: jest.fn(),
    upsertSignup: jest.fn(),
    getCurrentSignup: jest.fn(),
    switchSignup: jest.fn(),
    deleteSignup: jest.fn(),
    createPendingProject: jest.fn(),
    updateProjectStatus: jest.fn(),
  },
}));

const sqlMock = sql as unknown as jest.Mock & { begin: jest.Mock };
const mirrorMock = mirror as unknown as {
  enabled: boolean;
  upsertParticipant: jest.Mock;
  upsertProject: jest.Mock;
  upsertSignup: jest.Mock;
  deleteSignup: jest.Mock;
  appendEvent: jest.Mock;
};

describe("server handlers", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.begin = jest.fn();
    mirrorMock.upsertParticipant.mockReset();
    mirrorMock.upsertProject.mockReset();
    mirrorMock.upsertSignup.mockReset();
    mirrorMock.deleteSignup.mockReset();
    mirrorMock.appendEvent.mockReset();
    (globalThis as { __MIRROR_ENABLED__?: boolean }).__MIRROR_ENABLED__ = false;
  });

  it("returns cards with pagination metadata and preview names", async () => {
    sqlMock.mockResolvedValueOnce([
      {
        projectId: "11111111-1111-4111-8111-111111111111",
        title: "AI Trip Planner",
        shortDescription: "Plan travel with AI",
        signupCount: 7,
        participantNames: ["A", "B", "C", "D", "E", "F"],
        isSignedUp: true,
      },
      {
        projectId: "22222222-2222-4222-8222-222222222222",
        title: "Overflow row",
        shortDescription: "Used to compute hasMore",
        signupCount: 0,
        participantNames: [],
        isSignedUp: false,
      },
    ]);

    const response = await app.request(
      "/api/projects/cards?limit=1&offset=0",
      { headers: { "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{
        projectId: string;
        participantNamesPreview: string[];
      }>;
      hasMore: boolean;
      limit: number;
      offset: number;
    };

    expect(body.limit).toBe(1);
    expect(body.offset).toBe(0);
    expect(body.hasMore).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].projectId).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.items[0].participantNamesPreview).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("returns approved project details with full participant list", async () => {
    sqlMock
      .mockResolvedValueOnce([
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "AI Trip Planner",
          shortDescription: "Plan travel with AI",
        },
      ])
      .mockResolvedValueOnce([{ displayName: "Sara" }, { displayName: "Ali" }]);

    const response = await app.request("/api/projects/11111111-1111-4111-8111-111111111111");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      title: "AI Trip Planner",
      shortDescription: "Plan travel with AI",
      participants: ["Sara", "Ali"],
    });
  });

  it("returns 404 for unknown or non-approved project details", async () => {
    sqlMock.mockResolvedValueOnce([]);

    const response = await app.request("/api/projects/11111111-1111-4111-8111-111111111111");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Project not found" });
  });

  it("updates project status through admin endpoint", async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "AI Trip Planner",
        status: "approved",
      },
    ]);

    const response = await app.request("/api/admin/projects/11111111-1111-4111-8111-111111111111/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": "test-admin-secret",
      },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      title: "AI Trip Planner",
      status: "approved",
    });
  });

  it("supports join -> switch -> give up lifecycle", async () => {
    sqlMock
      .mockResolvedValueOnce([{ id: "participant-1" }])
      .mockResolvedValueOnce([{ status: "approved" }])
      .mockResolvedValueOnce([{ participant_id: "participant-1", project_id: "project-1" }])
      .mockResolvedValueOnce([{ id: "participant-1" }])
      .mockResolvedValueOnce([{ status: "approved" }])
      .mockResolvedValueOnce([{ project_id: "project-1" }])
      .mockResolvedValueOnce([{ id: "participant-1" }])
      .mockResolvedValueOnce([{ participant_id: "participant-1" }]);

    sqlMock.begin.mockImplementation(async (callback: (tx: typeof sqlMock) => Promise<unknown>) => {
      const tx = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ participant_id: "participant-1", project_id: "project-2" }]);
      return callback(tx as unknown as typeof sqlMock);
    });

    const joinResponse = await app.request("/api/signups/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      body: JSON.stringify({ projectId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(joinResponse.status).toBe(200);
    expect(await joinResponse.json()).toEqual({
      participantId: "participant-1",
      projectId: "project-1",
    });

    const switchResponse = await app.request("/api/signups/switch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      body: JSON.stringify({ projectId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(switchResponse.status).toBe(200);
    expect(await switchResponse.json()).toEqual({
      participantId: "participant-1",
      projectId: "project-2",
    });

    const giveUpResponse = await app.request("/api/signups", {
      method: "DELETE",
      headers: {
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });

    expect(giveUpResponse.status).toBe(200);
    expect(await giveUpResponse.json()).toEqual({
      participantId: "participant-1",
      deleted: true,
    });
  });

  it("keeps proposed projects hidden from cards until approved", async () => {
    sqlMock
      .mockResolvedValueOnce([{ id: "participant-1" }])
      .mockResolvedValueOnce([
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Pending Proposal",
          short_description: "Created as pending",
          status: "pending",
        },
      ])
      .mockResolvedValueOnce([
        {
          projectId: "11111111-1111-4111-8111-111111111111",
          title: "Approved Project",
          shortDescription: "Only approved cards should appear",
          signupCount: 1,
          participantNames: ["Ada"],
          isSignedUp: false,
        },
      ]);

    const proposeResponse = await app.request("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      body: JSON.stringify({
        title: "Pending Proposal",
        shortDescription: "Created as pending",
      }),
    });

    expect(proposeResponse.status).toBe(201);
    expect(await proposeResponse.json()).toEqual({
      projectId: "33333333-3333-4333-8333-333333333333",
      title: "Pending Proposal",
      shortDescription: "Created as pending",
      status: "pending",
    });

    const cardsResponse = await app.request("/api/projects/cards?limit=20&offset=0", {
      headers: {
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });

    expect(cardsResponse.status).toBe(200);
    expect(await cardsResponse.json()).toEqual({
      items: [
        {
          projectId: "11111111-1111-4111-8111-111111111111",
          title: "Approved Project",
          shortDescription: "Only approved cards should appear",
          signupCount: 1,
          participantNamesPreview: ["Ada"],
          isSignedUp: false,
        },
      ],
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it("skips mirror writes when debug sqlite mirror is disabled", async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: "participant-1",
        display_name: "Grace Hopper",
        client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    ]);

    const response = await app.request("/api/participants/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      body: JSON.stringify({ displayName: "Grace Hopper" }),
    });

    expect(response.status).toBe(200);
    expect(mirrorMock.upsertParticipant).not.toHaveBeenCalled();
  });

  it("does not fail API responses when mirror write throws", async () => {
    (globalThis as { __MIRROR_ENABLED__?: boolean }).__MIRROR_ENABLED__ = true;
    mirrorMock.upsertParticipant.mockImplementationOnce(() => {
      throw new Error("mirror down");
    });

    sqlMock.mockResolvedValueOnce([
      {
        id: "participant-1",
        display_name: "Grace Hopper",
        client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    ]);

    const response = await app.request("/api/participants/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      body: JSON.stringify({ displayName: "Grace Hopper" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      participantId: "participant-1",
      displayName: "Grace Hopper",
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });
});
