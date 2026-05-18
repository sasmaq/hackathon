/** @jest-environment node */

import { app } from "./index";
import { sql } from "./db/client.js";

jest.mock("@hono/node-server", () => ({
  serve: jest.fn(),
}));

jest.mock("./env.js", () => ({
  env: {
    port: 8787,
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    corsOrigins: ["http://localhost:5173"],
  },
}));

jest.mock("./db/client.js", () => ({
  sql: jest.fn(),
}));

const sqlMock = sql as unknown as jest.Mock;

describe("server handlers", () => {
  beforeEach(() => {
    sqlMock.mockReset();
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
});
