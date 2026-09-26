import { expect, test, type APIRequestContext } from "@playwright/test";

const ADMIN = { "x-admin-secret": "e2e-admin-secret" };

async function admin(request: APIRequestContext, action: "open" | "close") {
  const response = await request.post("/api/admin/round", { headers: ADMIN, data: { action, durationMinutes: 30 } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("a demo player enters, sponsors the pool, passes the checkpoint, plays week 1 and gets a verdict", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByText("4 weeks. 4 games.")).toBeVisible();
  await page.screenshot({ path: "e2e/screens/01-landing.png", fullPage: true });

  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByText("One human, one seat.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify with World ID" })).toBeVisible();
  await expect(page.getByText(/selfie/i)).toHaveCount(0);
  await page.screenshot({ path: "e2e/screens/02-world-id.png" });

  await page.getByRole("button", { name: "Demo: simulate World ID" }).click();
  await expect(page.getByText("Enter the arena.")).toBeVisible();
  await page.getByRole("button", { name: /Pay 1 USDC/ }).click();
  await expect(page.getByText("You're in.")).toBeVisible();
  await expect(page.getByText("1 alive")).toBeVisible();

  // Sponsor top-up grows the pool: 1 (ticket) + 25 = 26 USDC.
  await page.getByRole("button", { name: "25", exact: true }).click();
  await page.getByRole("button", { name: /Top up 25 USDC/ }).click();
  await expect(page.getByText("Thanks! +25 USDC added to the pool.")).toBeVisible();
  await expect(page.getByText(/^26\s*USDC$/)).toBeVisible();
  await expect(page.getByText("25 USDC from 1 sponsor")).toBeVisible();
  await page.screenshot({ path: "e2e/screens/03-topup.png", fullPage: true });

  await admin(request, "open");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Rock · Paper · Scissors" })).toBeVisible();
  await page.getByRole("button", { name: "Demo: pass the checkpoint" }).click();
  await page.getByRole("button", { name: "Start the game" }).click();
  await expect(page.getByText("Provably fair · committed")).toBeVisible();

  for (let i = 0; i < 15; i += 1) {
    const rock = page.getByRole("button", { name: /Rock/ });
    if (!(await rock.isVisible())) break;
    await rock.click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByText("Verdict when the week closes")).toBeVisible();
  await expect(page.getByText(/Provably fair · verified ✓/)).toBeVisible();
  await page.screenshot({ path: "e2e/screens/04-rps-finished.png", fullPage: true });

  const closed = await admin(request, "close");
  await page.reload();
  if (closed.data.survivors.length === 1) {
    await expect(page.getByText("You survived week 1.")).toBeVisible();
  } else {
    await expect(page.getByText("Eliminated in week 1.")).toBeVisible();
  }
  await page.screenshot({ path: "e2e/screens/05-verdict.png", fullPage: true });
});

test("protected routes reject anonymous and non-admin callers", async ({ request }) => {
  expect((await request.post("/api/game/start", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/world-id/rp-signature", { data: { kind: "entry" } })).status()).toBe(401);
  expect((await request.post("/api/topup/request", { data: { amountUsdc: "5" } })).status()).toBe(401);
  expect((await request.post("/api/admin/round", { data: { action: "open" } })).status()).toBe(401);
});
