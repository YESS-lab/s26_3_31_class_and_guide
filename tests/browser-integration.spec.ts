import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Browser integration tests for the Rocky agent.
 *
 * These use Playwright to drive a real headless browser against the Docker
 * container. They click buttons, type into inputs, press Enter, upload files,
 * and verify Rocky responds — the same way a real user would.
 *
 * Prerequisites:
 *   - Docker container running on port 3099 (started by docker-integration.test.sh)
 *     OR pass BASE_URL env var to point elsewhere
 *   - ANTHROPIC_API_KEY set (via .env or environment)
 *
 * Run:
 *   npx playwright test tests/browser-integration.spec.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3099";

// Timeout per test — agent responses can take a while
test.setTimeout(180_000);

/**
 * Helper: click "New Chat", wait for input to be enabled, type a message,
 * press Enter, and wait for Rocky's response bubble to appear.
 * Returns the text content of the assistant's response.
 */
async function sendMessageAndWaitForResponse(
  page: Page,
  message: string,
): Promise<string> {
  const input = page.locator('input[placeholder="Type a message..."]');
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 10_000 });

  await input.fill(message);
  await page.keyboard.press("Enter");

  // Wait for "Thinking..." to appear then disappear (agent is processing)
  const thinking = page.locator("text=Thinking...");
  await thinking.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {
    // It may have already come and gone — that's fine
  });
  await thinking.waitFor({ state: "hidden", timeout: 120_000 });

  // Get the last assistant message bubble (gray background, not blue)
  // Assistant messages are in the non-blue bubbles
  const assistantBubbles = page.locator(
    '.bg-gray-100 p.whitespace-pre-wrap',
  );
  const count = await assistantBubbles.count();
  expect(count).toBeGreaterThan(0);

  const lastResponse = assistantBubbles.nth(count - 1);
  const text = await lastResponse.textContent();
  return text || "";
}

test.describe("Browser: Basic UI", () => {
  test("page loads with branding and welcome message", async ({ page }) => {
    await page.goto(BASE_URL);

    // Branding header should show agent name
    await expect(page.locator("h1")).toContainText("Mindful Consumption", {
      timeout: 10_000,
    });

    // Welcome message from agent-config.json should be visible (before any chat is created)
    const welcomeText = page.locator("text=Is Rocky");
    await expect(welcomeText).toBeVisible({ timeout: 5_000 });
  });

  test("can create a new chat", async ({ page }) => {
    await page.goto(BASE_URL);

    // Click "New Chat" button
    await page.click("text=New Chat");

    // Input should appear and be enabled after WebSocket connects
    const input = page.locator('input[placeholder="Type a message..."]');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await expect(input).toBeEnabled({ timeout: 10_000 });
  });

  test("persona editor is visible in sidebar", async ({ page }) => {
    await page.goto(BASE_URL);

    // "About You" toggle button should be in the sidebar
    await expect(
      page.getByRole("button", { name: /About You/ }),
    ).toBeVisible({ timeout: 5_000 });

    // Persona fields should be present
    await expect(page.locator('input[placeholder="What should I call you?"]')).toBeVisible();
  });
});

test.describe("Browser: 5-Turn Conversation", () => {
  test("Rocky responds to each of 5 turns", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click("text=New Chat");

    const messages = [
      "Hi Rocky, I keep seeing ads for a new phone and I think I need it",
      "Well everyone at work has the latest model and I feel left out",
      "I guess I want to feel like I belong and am not behind",
      "Actually my current phone works fine, I just feel pressure",
      "You are right, thanks for helping me think about this",
    ];

    for (let i = 0; i < messages.length; i++) {
      const turnNum = i + 1;
      console.log(`  Turn ${turnNum} user: ${messages[i].slice(0, 60)}...`);

      const response = await sendMessageAndWaitForResponse(page, messages[i]);

      console.log(`    Rocky: ${response.slice(0, 200)}`);
      expect(response.length).toBeGreaterThan(0);

      // Verify it's not a generic coding assistant response
      const lower = response.toLowerCase();
      expect(lower).not.toContain("i'm claude");
      expect(lower).not.toContain("software engineering");
    }
  });
});

test.describe("Browser: File Upload + Secret Retrieval", () => {
  test("Rocky finds secret from uploaded file", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click("text=New Chat");

    // Wait for input to be ready
    const input = page.locator('input[placeholder="Type a message..."]');
    await expect(input).toBeEnabled({ timeout: 10_000 });

    // Send a first message to establish the session (creates the session
    // in the server's sessions map so file uploads get registered)
    console.log("  Establishing session with first message...");
    const greeting = await sendMessageAndWaitForResponse(page, "Hi Rocky");
    console.log(`    Rocky: ${greeting.slice(0, 200)}`);

    // Now upload a file with a secret via the file input
    const fileContent = [
      "My personal notes:",
      "I have been thinking about what matters to me.",
      "The secret code is: bananagrams",
      "I want to focus on experiences not things.",
    ].join("\n");

    // Create a temp file for upload
    const tmpDir = path.join(__dirname, ".tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const tmpFile = path.join(tmpDir, "my-secret-notes.txt");
    fs.writeFileSync(tmpFile, fileContent);

    // Find the hidden file input and upload
    console.log("  Uploading file with secret...");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tmpFile);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Now have a conversation asking about the file
    const messages = [
      "I just uploaded a file with some personal notes, can you read it?",
      "What did you find in the file?",
      "Is there anything specific like a code or secret in the file?",
      "What exactly is the secret in the file?",
    ];

    let foundSecret = false;

    for (let i = 0; i < messages.length; i++) {
      const turnNum = i + 1;
      console.log(`  Turn ${turnNum} user: ${messages[i].slice(0, 60)}...`);

      const response = await sendMessageAndWaitForResponse(page, messages[i]);

      console.log(`    Rocky: ${response.slice(0, 300)}`);
      expect(response.length).toBeGreaterThan(0);

      if (response.toLowerCase().includes("bananagrams")) {
        foundSecret = true;
        console.log(`    ^^^ Secret 'bananagrams' found on turn ${turnNum}!`);
      }
    }

    expect(foundSecret).toBe(true);

    // Cleanup temp file
    fs.unlinkSync(tmpFile);
    fs.rmdirSync(tmpDir);
  });
});
