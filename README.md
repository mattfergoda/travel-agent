# Profile Builder

A single-page conversational travel profile builder for the Atlas take-home exercise.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## LLM Configuration

The app is configured for OpenAI-compatible providers through OpenRouter.

Required in `.env.local`:

```bash
OPENROUTER_API_KEY=your_key_here
LLM_MODEL=openai/gpt-4o-mini
LLM_BASE_URL=https://openrouter.ai/api/v1
```

OpenRouter can route to many model families, including Anthropic models, by changing `LLM_MODEL`. Direct Anthropic API support would be a small future provider adapter, not part of this two-hour implementation.

If credentials are missing or invalid, the UI still loads and chat requests return a clear setup error. Profile state is not mutated when the LLM call fails.

## Architecture

- Next.js + TypeScript single-page app.
- Vercel AI SDK for streaming chat and structured extraction.
- zod validates HTTP requests, LLM extraction output, and persisted JSON state.
- Server-side JSON persistence in `data/state.json` for the assignment's single-user scope.
- Hybrid agentic orchestration: the model interprets messages and proposes profile updates; app code validates and owns durable mutation.

## Destination Tool

`getDestinationInfo(name)` is implemented with hardcoded data for Tokyo, Paris, Mexico City, Reykjavik, and Lisbon. Unknown destinations return `null`; the assistant is instructed not to invent facts when tool data is unavailable.

## Conflict Handling

The extraction step can propose conflicts. App code stores those conflicts and blocks conflicting profile field updates until the user clarifies. This avoids silent overwrites of durable preferences.

## Tradeoffs

- JSON files instead of Postgres or SQLite to fit the two-hour scope.
- App-orchestrated destination calls instead of native provider tool-calling for portability across OpenRouter models.
- Extraction before streaming so the assistant can ask conflict-resolution questions in the same turn.
- The profile panel refreshes after each streamed turn; live profile updates during token streaming are left out.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

Targeted tests cover destination lookup, zod schemas, persistence, and profile merge/conflict behavior.

## Known Gaps

- Single-user local JSON persistence only.
- No auth, bookings, payments, or real travel APIs.
- Conflict resolution is functional but intentionally simple.
- Direct Anthropic provider support is not implemented.
- The demo favors desktop layout.

## With Another Day

- Move persistence to SQLite or Postgres.
- Add richer conflict-resolution UI controls.
- Add eval fixtures for extraction and conflict detection.
- Add direct provider adapters for Anthropic and OpenAI.
- Improve conflict-resolution UI controls.

## At Scale

For 10k requests/hour, I would move profile and chat state to Postgres, add request tracing and structured model logs, introduce extraction evals before model changes, separate streaming chat from background profile extraction when latency matters, and add provider fallbacks/rate-limit handling.
