import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAssistantSystemPrompt, getProviderStatus } from "@/lib/server/llm";
import { AppStateSchema, type ExtractionResult } from "@/lib/shared/schemas";

const originalApiKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.LLM_MODEL;
const originalBaseUrl = process.env.LLM_BASE_URL;

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_BASE_URL;
});

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalApiKey;
  }

  if (originalModel === undefined) {
    delete process.env.LLM_MODEL;
  } else {
    process.env.LLM_MODEL = originalModel;
  }

  if (originalBaseUrl === undefined) {
    delete process.env.LLM_BASE_URL;
  } else {
    process.env.LLM_BASE_URL = originalBaseUrl;
  }
});

describe("getProviderStatus", () => {
  it("reports missing OpenRouter configuration without exposing secrets", () => {
    expect(getProviderStatus()).toEqual({
      configured: false,
      model: "openai/gpt-4o-mini",
      baseUrl: "https://openrouter.ai/api/v1",
      missing: ["OPENROUTER_API_KEY"],
    });
  });

  it("reports configured provider settings from the environment", () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.LLM_MODEL = "test/model";
    process.env.LLM_BASE_URL = "https://example.invalid/v1";

    expect(getProviderStatus()).toEqual({
      configured: true,
      model: "test/model",
      baseUrl: "https://example.invalid/v1",
      missing: [],
    });
  });
});

describe("buildAssistantSystemPrompt", () => {
  it("includes state, destination tool results, and extractor notes", () => {
    const state = AppStateSchema.parse({
      profile: { homeLocation: "Denver", preferredDestinations: ["Tokyo"] },
      messages: [],
      conflicts: [],
    });
    const extraction: ExtractionResult = {
      profilePatch: {},
      conflicts: [],
      destinationMentions: ["Tokyo"],
      resolvedConflictIds: [],
      notesForAssistant: "Ask about trip length.",
    };

    const prompt = buildAssistantSystemPrompt({
      state,
      destinationResults: [{ name: "Tokyo", info: null }],
      extraction,
    });

    expect(prompt).toContain("Atlas Profile Builder");
    expect(prompt).toContain("Denver");
    expect(prompt).toContain("Tokyo");
    expect(prompt).toContain("Ask about trip length.");
  });
});
