import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 180_000,
  retries: 0,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || "http://localhost:3099",
  },
  reporter: "list",
});
