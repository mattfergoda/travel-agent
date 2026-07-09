import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAssistantSystemPrompt, getProviderStatus, streamAssistantResponse } from "@/lib/server/llm";
import { AppStateSchema, type ExtractionResult } from "@/lib/shared/schemas";

const llmMocks = vi.hoisted(() => ({
  createOpenAICompatible: vi.fn(() => vi.fn((model: string) => ({ model }))),
  generateObject: vi.fn(),
  streamText: vi.fn(() => ({ textStream: (async function* emptyStream() {})() })),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: llmMocks.createOpenAICompatible,
}));

vi.mock("ai", () => ({
  generateObject: llmMocks.generateObject,
  streamText: llmMocks.streamText,
}));

const originalApiKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.LLM_MODEL;
const originalBaseUrl = process.env.LLM_BASE_URL;

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_BASE_URL;
  llmMocks.createOpenAICompatible.mockClear();
  llmMocks.generateObject.mockClear();
  llmMocks.streamText.mockClear();
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

describe("streamAssistantResponse", () => {
  it("uses recent state messages without appending the latest user message twice", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const state = AppStateSchema.parse({
      profile: {},
      messages: [
        { id: "message-1", role: "assistant", content: "Where do you want to go?", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "message-2", role: "user", content: "I like Tokyo", createdAt: "2026-01-01T00:01:00.000Z" },
      ],
      conflicts: [],
    });
    const extraction: ExtractionResult = {
      profilePatch: {},
      conflicts: [],
      destinationMentions: ["Tokyo"],
      resolvedConflictIds: [],
      notesForAssistant: "Mention Tokyo.",
    };

    await streamAssistantResponse({
      state,
      userMessage: "I like Tokyo",
      destinationResults: [{ name: "Tokyo", info: null }],
      extraction,
    });

    expect(llmMocks.streamText).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: "assistant", content: "Where do you want to go?" },
        { role: "user", content: "I like Tokyo" },
      ],
    }));
  });
});
