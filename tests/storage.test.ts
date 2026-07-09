import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createStorage } from "@/lib/server/storage";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

async function tempFile() {
  tempDir = await mkdtemp(join(tmpdir(), "profile-builder-"));
  return join(tempDir, "state.json");
}

describe("createStorage", () => {
  it("returns empty state when the file is missing", async () => {
    const storage = createStorage({ filePath: await tempFile() });
    await expect(storage.load()).resolves.toMatchObject({ profile: {}, messages: [], conflicts: [] });
  });

  it("saves and reloads validated state", async () => {
    const storage = createStorage({ filePath: await tempFile() });
    const state = await storage.load();
    state.profile.homeLocation = "Denver";
    await storage.save(state);
    await expect(storage.load()).resolves.toMatchObject({ profile: { homeLocation: "Denver" } });
  });

  it("throws a clear error for malformed state", async () => {
    const filePath = await tempFile();
    await writeFile(filePath, JSON.stringify({ profile: { budgetLevel: "expensive" }, messages: [], conflicts: [] }));
    const storage = createStorage({ filePath });
    await expect(storage.load()).rejects.toThrow("Stored app state failed validation");
  });
});
