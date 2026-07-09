import { NextResponse } from "next/server";
import { ChatRequestSchema, type AppState, type ChatMessage } from "@/lib/shared/schemas";
import { detectKnownDestinations, getDestinationInfo } from "@/lib/server/destinations";
import { extractFromMessage, getProviderStatus, streamAssistantResponse } from "@/lib/server/llm";
import { logEvent } from "@/lib/server/logging";
import { applyExtractionToState } from "@/lib/server/profile-updates";
import { createStorage } from "@/lib/server/storage";

export const runtime = "nodejs";

function messageId() {
  return crypto.randomUUID();
}

function streamAndPersist(input: { stream: AsyncIterable<string>; storage: ReturnType<typeof createStorage>; state: AppState }) {
  const encoder = new TextEncoder();
  let assistantContent = "";

  return new Response(new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of input.stream) {
          assistantContent += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        const assistantMessage: ChatMessage = {
          id: messageId(),
          role: "assistant",
          content: assistantContent,
          createdAt: new Date().toISOString(),
        };

        await input.storage.save({
          ...input.state,
          messages: [...input.state.messages, assistantMessage],
        });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  }), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-profile-builder-state": "refresh-after-stream",
    },
  });
}

export async function POST(request: Request) {
  let requestJson: unknown;
  try {
    requestJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON request" }, { status: 400 });
  }

  const parsedRequest = ChatRequestSchema.safeParse(requestJson);

  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Invalid chat request", details: parsedRequest.error.flatten() }, { status: 400 });
  }

  const provider = getProviderStatus();
  if (!provider.configured) {
    return NextResponse.json({ error: `Missing LLM configuration: ${provider.missing.join(", ")}` }, { status: 400 });
  }

  const storage = createStorage();
  const loadedState = await storage.load();
  const now = new Date().toISOString();
  const userMessage: ChatMessage = {
    id: messageId(),
    role: "user",
    content: parsedRequest.data.message,
    createdAt: now,
  };
  const stateWithUser = { ...loadedState, messages: [...loadedState.messages, userMessage] };
  const knownDestinations = detectKnownDestinations(parsedRequest.data.message);

  try {
    const extraction = await extractFromMessage({ state: stateWithUser, userMessage: parsedRequest.data.message, knownDestinations });
    const destinationNames = Array.from(new Set([...knownDestinations, ...extraction.destinationMentions].map((name) => name.trim()).filter(Boolean)));
    const destinationResults = await Promise.all(destinationNames.map(async (name) => ({ name, info: await getDestinationInfo(name) })));

    for (const result of destinationResults) {
      logEvent("tool.getDestinationInfo", { name: result.name, found: result.info !== null });
    }

    const nextState = applyExtractionToState(stateWithUser, extraction);
    const stream = await streamAssistantResponse({
      state: nextState,
      userMessage: parsedRequest.data.message,
      destinationResults,
      extraction,
    });

    return streamAndPersist({ stream: stream.textStream, storage, state: nextState });
  } catch (error) {
    await storage.save(stateWithUser);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat failed" }, { status: 500 });
  }
}
