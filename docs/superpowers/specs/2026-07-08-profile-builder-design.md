# Profile Builder Design

Date: 2026-07-08

## Context

The assignment is to build a single-page web app called Profile Builder in about two hours. The app should help a traveler create a durable travel profile through conversation. The evaluators care about the working artifact, but they also explicitly evaluate judgment, process, commit history, README quality, typed contracts, runtime validation, streaming, AI integration, conflict handling, and clear tradeoff explanations.

The design optimizes for a realistic two-hour implementation rather than a broad production architecture.

## Goals

- Provide a working chat UI with streamed assistant responses.
- Extract structured travel profile fields from the conversation.
- Persist the profile across reloads.
- Show a read-only profile view in the main UI.
- Keep a typed, validated contract between client, server, LLM outputs, and persistence.
- Call `getDestinationInfo(name)` whenever a destination is referenced, and use the result in the assistant response.
- Detect contradictions and ask for user consent before applying conflicting profile changes.
- Include a README and PROCESS.md that explain setup, choices, tradeoffs, and known gaps.

## Non-Goals

- Authentication, accounts, or multi-user support.
- Real travel APIs or booking flows.
- A production database or deployment architecture.
- Full test coverage.
- Mobile polish beyond avoiding severe layout breakage.
- A heavy autonomous-agent framework unless a concrete need appears during implementation.

## Recommended Approach

Use a lean hybrid orchestration design:

- Framework: Next.js with TypeScript.
- LLM integration: Vercel AI SDK using an OpenAI-compatible provider configuration.
- Primary provider path: OpenRouter, configured by environment variables.
- Validation: zod at HTTP, LLM, and persistence boundaries.
- Persistence: server-side JSON file storage for the single-user assignment scope.
- AI flow: the model interprets messages and proposes structured updates; app code validates, applies safe updates, blocks conflicting updates, and persists state.

This keeps the implementation agentic where it matters without letting the model directly mutate durable state.

## Alternatives Considered

### Heavy agent framework

LangChain, LangGraph, or a similar harness would make the project look more explicitly agentic and could provide native concepts for tools and state. It also adds abstraction, setup overhead, and debugging risk inside the two-hour limit. This is not recommended for the initial build.

### Direct provider SDK or raw fetch

A direct OpenAI-compatible fetch implementation would minimize dependencies and maximize control. It would also require more custom streaming code and more plumbing around model configuration. This is not recommended because streaming correctness is a must-have and the AI SDK already solves it well.

### Production database

SQLite, Postgres, or a hosted KV store would be closer to production persistence. For this assignment, data modeling and setup overhead are not worth the time cost. The README should explicitly state that production would move state to SQLite or Postgres.

## Provider Configuration

The app should support OpenAI-compatible providers through environment variables:

- `OPENROUTER_API_KEY`, or a generic compatible API key if we choose a generic name during implementation.
- `LLM_MODEL`, for example an OpenRouter model identifier.
- `LLM_BASE_URL`, defaulting to `https://openrouter.ai/api/v1` if using OpenRouter.

OpenRouter is the documented primary provider because it can route to many model families, including Anthropic models, while preserving an OpenAI-compatible API surface. Direct Anthropic API support is a future adapter, not part of the initial scope.

If credentials are missing or invalid, the app should load normally and return a clear chat error explaining how to configure the provider. Secrets must stay out of the repo.

## UI Design

Use a simple two-column desktop layout:

- Left column: chat transcript and message input.
- Right column: read-only travel profile, unresolved conflicts, and basic provider/model status.
- Header: app name and possibly a reset control.

This layout makes the core loop obvious: the user chats on the left while the durable extracted profile evolves on the right.

## Travel Profile Schema

Start with a compact schema that is useful for travel planning without becoming a CRM model:

- `homeLocation`
- `preferredDestinations`
- `tripTypes`: values such as relaxation, adventure, food, culture, nightlife, nature, family, and work.
- `budgetLevel`: budget, midRange, or luxury.
- `pace`: relaxed, balanced, or packed.
- `lodgingStyle`
- `foodPreferences`
- `accessibilityNeeds`
- `travelCompanions`
- `preferredSeasons`
- `constraints`: visa, mobility, schedule, dietary, or avoid-list constraints.
- `openQuestions`: clarifications the assistant still needs.

The implementation can represent uncertain or missing fields as absent or empty, but should avoid inventing preferences.

## Persistent State

Use server-side JSON persistence for the assignment version. A single persisted state file is acceptable and likely simplest:

- `profile`: the current travel profile.
- `messages`: recent chat messages.
- `conflicts`: unresolved and resolved profile conflicts.

The app should validate loaded JSON with zod before using it. If the state file is missing, initialize an empty state. If the file is malformed, return a clear error rather than silently corrupting or overwriting data.

This intentionally assumes one user, matching the assignment scope.

## Destination Tool

Implement the required function:

```ts
async function getDestinationInfo(name: string): Promise<DestinationInfo | null>
```

Use at least five hardcoded destinations. Good initial choices are Tokyo, Paris, Mexico City, Reykjavik, and Lisbon. Each destination includes the required fields:

- `name`
- `bestSeasons`
- `knownFor`
- `averageDailyBudgetUSD`
- `visaNotes` when useful

The function returns `null` for unknown destinations. The assistant must treat `null` as a constraint: it can ask preference-oriented follow-up questions, but should not hallucinate destination facts.

Destination detection can be app-orchestrated rather than native model tool-calling. The initial implementation should combine deterministic detection of known destination names with destination mentions returned by the structured extraction call. The server should call `getDestinationInfo` for the union of detected names before streaming the assistant response, then inject the results into the assistant prompt.

## Chat Turn Flow

Use extraction-before-streaming so conflicts can be surfaced in the same assistant response.

```txt
User submits message
  -> server validates request body
  -> server loads and validates persisted state
  -> server appends user message
  -> server detects known destination mentions deterministically
  -> server runs a structured extraction LLM call
  -> server validates extraction output with zod
  -> server calls getDestinationInfo for each destination mention
  -> server applies safe profile updates
  -> server stores conflicts without applying conflicting fields
  -> server streams assistant response using profile, destination info, and conflicts
  -> server persists assistant message and updated state
  -> client refreshes profile state after streaming completes
```

The client should not infer profile state from assistant text. It should render server state, either from chat response metadata if that remains simple or from a follow-up `GET /api/state` call after each streamed response.

## Structured Extraction

After each user message and before the assistant response, call the model for JSON-only extraction. The exact implementation may use AI SDK structured output helpers or explicit JSON prompting, but the returned shape must be validated before use.

The extraction output should include:

- `profilePatch`: proposed profile changes, which the app filters before applying.
- `conflicts`: proposed conflict candidates.
- `destinationMentions`: destinations the model noticed, used together with deterministic app detection before calling `getDestinationInfo`.
- `resolvedConflictIds`: conflicts the user explicitly resolved.
- `notesForAssistant`: optional short context that helps the streamed response ask better follow-up questions.

Invalid extraction output should not mutate the profile. The app can still stream a conversational response if possible, while logging the extraction validation failure.

## Profile Merge Rules

The app owns durable state transitions.

- Array fields accumulate unique values unless a conflict is present.
- Scalar fields can be set when empty.
- Scalar fields are not silently overwritten with materially different values.
- Conflicting updates are stored as unresolved conflicts and excluded from the applied profile patch.
- Explicit user resolution can apply the proposed value, keep the existing value, or keep both as contextual notes depending on the field.

The model can identify semantic contradictions, but app code enforces the rule that conflicting durable updates require user consent.

## Conflict Handling

Conflict handling should be localized to a small profile update module rather than scattered through UI and API code.

Example:

- Existing profile: `foodPreferences = ["vegetarian"]`.
- New user message: "I want to visit great steakhouses."
- Extraction proposes a conflict for `foodPreferences` with a reason.
- App stores the conflict and does not overwrite `foodPreferences`.
- Assistant asks: "Earlier you mentioned vegetarian preferences, but now you are interested in steakhouses. Should I update that preference, keep vegetarian as a constraint, or note that steakhouses are for someone else?"

The profile panel should show unresolved conflicts until the user resolves them.

## API Shape

Expected routes:

- `POST /api/chat`: validates a user message, processes the turn, and streams the assistant response.
- `GET /api/state`: returns the validated current profile, messages as needed by the client, conflicts, and provider status.
- Optional `POST /api/reset`: clears local JSON state for demo convenience if time allows.

Shared TypeScript types should describe request bodies, profile state, conflicts, destination info, and extraction output. zod schemas should validate all untrusted runtime inputs.

## Error Handling

- Missing API key: show a clear setup error and leave state unchanged.
- Invalid model or provider error: show a non-fatal chat error and leave state unchanged.
- Invalid extraction JSON: log the validation failure, skip profile mutation, and continue the conversation if possible.
- Unknown destination: call the tool, receive `null`, and make the assistant acknowledge limited destination data rather than invent facts.
- Persistence read/write failure: show a visible app error and avoid claiming the profile was saved.
- Conflict detected: store it, do not apply the conflicting field, and ask the user for consent.

Structured logs to stdout are a nice-to-have if time allows, especially for LLM calls and destination tool calls.

## Testing Strategy

Keep tests targeted and high-signal:

- `getDestinationInfo` returns data for known destinations and `null` for unknown destinations.
- zod schemas reject malformed extraction output.
- profile merge logic applies safe patches and blocks conflicting fields.
- optional API route tests if the setup cost is low.

The goal is not full coverage. The goal is confidence in the logic that would most hurt the demo if it broke.

## README Requirements

The README should get reviewers running in under five minutes and include:

- install and run commands.
- required environment variables.
- provider/model used during development.
- what happens when credentials are missing or invalid.
- core architecture decisions and tradeoffs.
- known gaps and what would change with another day.
- what would change at scale, especially provider choice, schema strategy, persistence, and evaluation.

## PROCESS.md Requirements

PROCESS.md should include:

- overall approach and why planning came first.
- 5 to 10 annotated prompt highlights from the AI session.
- what was reviewed by hand versus trusted.
- honest gaps and unverified areas.
- what would be done differently next time.
- scale-up notes for serving many requests.

The session transcript should be exported separately according to the tool's capabilities and referenced in the final submission.

## Scope Cuts

Cut from the initial two-hour implementation:

- production database.
- authentication or multi-user state.
- native provider-specific tool-calling.
- direct Anthropic provider adapter.
- rich mobile design.
- broad UI test coverage.
- live profile updates while assistant tokens are still streaming.

These cuts are deliberate and should be documented as such.

## Success Criteria

The design is successful if the final app demonstrates this loop end-to-end:

1. User chats with the assistant and sees streamed responses.
2. The assistant asks proactive but natural travel-preference questions.
3. The profile panel updates after user turns and survives reloads.
4. Mentioning a known destination calls `getDestinationInfo` and informs the assistant response.
5. Mentioning an unknown destination does not cause hallucinated destination facts.
6. A contradictory preference is surfaced for user consent rather than silently overwritten.
7. README and PROCESS.md clearly explain the choices, tradeoffs, and known gaps.
