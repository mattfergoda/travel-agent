import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, streamText } from "ai";
import { ExtractionResultSchema, type AppState, type DestinationInfo, type ExtractionResult, type ProviderStatus } from "@/lib/shared/schemas";
import { logEvent } from "@/lib/server/logging";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export function getProviderStatus(): ProviderStatus {
  const missing = process.env.OPENROUTER_API_KEY ? [] : ["OPENROUTER_API_KEY"];

  return {
    configured: missing.length === 0,
    model: process.env.LLM_MODEL ?? DEFAULT_MODEL,
    baseUrl: process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL,
    missing,
  };
}

function getModel() {
  const status = getProviderStatus();

  if (!status.configured) {
    throw new Error(`Missing LLM configuration: ${status.missing.join(", ")}`);
  }

  const provider = createOpenAICompatible({
    name: "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: status.baseUrl,
  });

  return provider(status.model);
}

function recentMessagesForPrompt(state: AppState) {
  return state.messages.slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n");
}

export async function extractFromMessage(input: { state: AppState; userMessage: string; knownDestinations: string[] }): Promise<ExtractionResult> {
  const started = Date.now();
  const model = getModel();

  const result = await generateObject({
    model,
    schema: ExtractionResultSchema,
    prompt: `You extract travel profile updates from one user message. Return only structured data matching the schema.

Rules:
- Do not invent preferences.
- Use profilePatch for preferences the user clearly stated.
- If a new preference contradicts an existing profile field, put it in conflicts and do not rely on profilePatch to overwrite it.
- If the user resolves an existing conflict, include that conflict id in resolvedConflictIds.
- Include destinationMentions for specific places the user mentioned, including places not in the known list.

Current profile:
${JSON.stringify(input.state.profile, null, 2)}

Unresolved conflicts:
${JSON.stringify(input.state.conflicts.filter((conflict) => conflict.status === "unresolved"), null, 2)}

Known destinations detected by app code:
${JSON.stringify(input.knownDestinations)}

Recent messages:
${recentMessagesForPrompt(input.state)}

User message:
${input.userMessage}`,
  });

  logEvent("llm.extract", { latencyMs: Date.now() - started, model: getProviderStatus().model });
  return ExtractionResultSchema.parse(result.object);
}

export function buildAssistantSystemPrompt(input: { state: AppState; destinationResults: Array<{ name: string; info: DestinationInfo | null }>; extraction: ExtractionResult }) {
  return `You are Atlas Profile Builder, a concise travel assistant. Help the user build a durable travel profile.

Behavior:
- Be transparent that you are learning travel preferences to improve recommendations.
- Ask one or two useful follow-up questions, not a long survey.
- Use destination data below when available.
- If destination data is null, say this demo has no stubbed data for that destination and avoid making factual claims about it.
- If unresolved conflicts exist, ask the user to resolve them before treating conflicting values as profile facts.

Current profile:
${JSON.stringify(input.state.profile, null, 2)}

Unresolved conflicts:
${JSON.stringify(input.state.conflicts.filter((conflict) => conflict.status === "unresolved"), null, 2)}

Destination tool results:
${JSON.stringify(input.destinationResults, null, 2)}

Extractor notes:
${input.extraction.notesForAssistant}`;
}

export async function streamAssistantResponse(input: { state: AppState; userMessage: string; destinationResults: Array<{ name: string; info: DestinationInfo | null }>; extraction: ExtractionResult }) {
  const started = Date.now();
  const model = getModel();

  const result = streamText({
    model,
    system: buildAssistantSystemPrompt(input),
    messages: [
      ...input.state.messages.slice(-8).map((message) => ({ role: message.role, content: message.content } as const)),
      { role: "user", content: input.userMessage },
    ],
    onFinish() {
      logEvent("llm.stream.finish", { latencyMs: Date.now() - started, model: getProviderStatus().model });
    },
  });

  return result;
}
