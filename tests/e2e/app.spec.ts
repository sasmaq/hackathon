import { expect, test, type Page } from "@playwright/test";

const IDENTITY_KEY = "hackathon.identity";

async function bootstrapIdentity(page: Page, displayName: string) {
  await page.addInitScript(
    ({ key, name }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          clientId: "participant-e2e",
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
  await page.goto("/project/ai-review-bot");

  const detailsPanel = page.getByLabel("Project details and proposals");
  await expect(page.getByText("Project Details")).toBeVisible();
  await expect(
    detailsPanel.getByRole("heading", { name: /ai pull request review bot/i, level: 2 }),
  ).toBeVisible();
  await expect(detailsPanel.getByRole("button", { name: /join project/i })).toBeVisible();
});

test("proposal route accepts a new project idea", async ({ page }) => {
  await bootstrapIdentity(page, "Margaret Hamilton");
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
  await page.goto("/this-route-does-not-exist");

  await expect(page.getByRole("heading", { name: /that page does not exist/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to project board/i })).toBeVisible();
});

test("unknown project route shows unavailable state", async ({ page }) => {
  await bootstrapIdentity(page, "Barbara Liskov");
  await page.goto("/project/not-an-approved-project");

  await expect(page.getByRole("heading", { name: /project unavailable/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to project board/i })).toBeVisible();
});
