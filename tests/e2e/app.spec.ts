import { expect, test, type Page } from "@playwright/test";

const IDENTITY_KEY = "hackathon.identity";
const KNOWN_PROJECT_ID = "11111111-1111-4111-8111-111111111111";

async function mockApi(page: Page) {
  await page.route("**/api/projects/cards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            projectId: KNOWN_PROJECT_ID,
            title: "AI Pull Request Review Bot",
            shortDescription:
              "Build an assistant that summarizes code changes and flags risky diffs before review.",
            signupCount: 2,
            participantNamesPreview: ["Grace Hopper", "Ada Lovelace"],
            isSignedUp: false,
          },
        ],
        limit: 6,
        offset: 0,
        hasMore: false,
      }),
    });
  });

  await page.route("**/api/projects", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        projectId: "88888888-8888-4888-8888-888888888888",
        title: "Agentic post-mortem helper",
        shortDescription: "Summarize incidents and suggest follow-up actions.",
        status: "pending",
      }),
    });
  });

  await page.route("**/api/projects/*", async (route) => {
    const url = route.request().url();
    const projectId = url.split("/api/projects/")[1];

    if (projectId === KNOWN_PROJECT_ID) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: KNOWN_PROJECT_ID,
          title: "AI Pull Request Review Bot",
          shortDescription:
            "Build an assistant that summarizes code changes and flags risky diffs before review.",
          participants: ["Grace Hopper", "Ada Lovelace"],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Project not found" }),
    });
  });

  await page.route("**/api/participants/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        participantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        displayName: "Margaret Hamilton",
        clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    });
  });
}

async function bootstrapIdentity(page: Page, displayName: string) {
  await page.addInitScript(
    ({ key, name }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          displayName: name,
        }),
      );
    },
    { key: IDENTITY_KEY, name: displayName },
  );
}

test("app renders at /", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /what should other participants call you\?/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("button", { name: /start browsing/i })).toBeVisible();
});

test("onboarding submits and opens project board", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page.getByLabel("Display name").fill("Grace Hopper");
  await page.getByRole("button", { name: /start browsing/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /pick one project to work on/i })).toBeVisible();
  await expect(page.getByLabel("Your display name")).toHaveValue("Grace Hopper");

  const identity = await page.evaluate((key) => localStorage.getItem(key), IDENTITY_KEY);
  expect(identity).toContain("Grace Hopper");
});

test("project details route renders details panel", async ({ page }) => {
  await bootstrapIdentity(page, "Ada Lovelace");
  await mockApi(page);
  await page.goto(`/project/${KNOWN_PROJECT_ID}`);

  const detailsPanel = page.getByLabel("Project details and proposals");
  await expect(detailsPanel.getByText("Project Details", { exact: true })).toBeVisible();
  await expect(
    detailsPanel.getByRole("heading", { name: /ai pull request review bot/i, level: 2 }),
  ).toBeVisible();
  await expect(detailsPanel.getByRole("button", { name: /join project/i })).toBeVisible();
});

test("proposal route accepts a new project idea", async ({ page }) => {
  await bootstrapIdentity(page, "Margaret Hamilton");
  await mockApi(page);
  await page.goto("/propose");

  await expect(page.getByRole("heading", { name: /suggest a new project/i })).toBeVisible();
  await page.getByLabel("Title").fill("Agentic post-mortem helper");
  await page.getByLabel("Short description").fill("Summarize incidents and suggest follow-up actions.");
  await page.getByRole("button", { name: /submit for review/i }).click();

  await expect(
    page.getByText("Thanks. Your project idea is pending manual review before it appears here."),
  ).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("");
  await expect(page.getByLabel("Short description")).toHaveValue("");
});

test("unknown route shows not found screen", async ({ page }) => {
  await bootstrapIdentity(page, "Linus Torvalds");
  await mockApi(page);
  await page.goto("/this-route-does-not-exist");

  await expect(page.getByRole("heading", { name: /that page does not exist/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to project board/i })).toBeVisible();
});

test("unknown project route shows unavailable state", async ({ page }) => {
  await bootstrapIdentity(page, "Barbara Liskov");
  await mockApi(page);
  await page.goto("/project/99999999-9999-4999-8999-999999999999");

  await expect(page.getByRole("heading", { name: /project unavailable/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to project board/i })).toBeVisible();
});
