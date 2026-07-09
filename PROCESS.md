# Process

## Overall Approach

I planned first because the assignment explicitly evaluates judgment, tradeoffs, and process artifacts. The design prioritizes a working, explainable two-hour slice over production infrastructure.

I kept the agentic boundary narrow: the LLM interprets the conversation and proposes profile changes, while application code validates and owns durable state.

## Annotated Prompt Highlights

1. **Scope and stack selection**
   I asked the agent to read the assignment and help choose a two-hour implementation strategy. I kept the recommendation to use Next.js and TypeScript because it matches the company's stack and reduces review friction.

2. **Persistence tradeoff**
   We compared Postgres/SQLite with server-side JSON. I chose JSON because the assignment assumes one user and values scope control; I documented the production database path instead of building it.

3. **Agent framework tradeoff**
   I questioned whether avoiding an agent harness would make the solution less agentic. I kept a hybrid approach: model-led interpretation, app-owned validation and mutation.

4. **Conflict handling design**
   We explored whether the model should directly update the profile. I rejected direct mutation because silent overwrites would fail the assignment's conflict-handling requirement.

5. **Extraction and streaming order**
   We compared streaming first versus extraction first. I chose extraction before streaming so the assistant can ask for conflict consent in the same turn.

6. **Destination tool strategy**
   We chose app-orchestrated destination calls rather than native tool-calling. This keeps provider/model configuration portable across OpenRouter models.

7. **Schema size**
   We kept a compact travel profile schema rather than adding loyalty programs, passport status, or detailed deal preferences. This avoided over-modeling before the core loop worked.

## What I Reviewed By Hand

- Assignment requirements and evaluation criteria.
- The design spec and implementation plan.
- Profile schema and conflict merge rules.
- LLM boundary prompts and zod validation points.

## What I Trusted More Heavily

- Framework scaffolding conventions.
- Basic UI styling.
- Standard package wiring, after running verification commands.

## Known Gaps And Honesty Notes

- This is not production persistence.
- Free or cheap OpenRouter models can be flaky with structured extraction.
- Conflict detection depends on the model identifying semantic contradictions; app code enforces consent after a conflict is proposed.
- Assistant message persistence depends on the custom stream wrapper completing successfully after the model stream finishes.

## What I Would Do Differently Next Time

- Start with a small extraction eval fixture set before prompt tuning.
- Add explicit UI controls for accepting or rejecting each conflict.
- Add richer assistant-message audit metadata, including model and latency.

## If This Served 10k Requests An Hour

- Use Postgres for profiles, messages, conflicts, and audit trails.
- Add structured tracing for every LLM call and tool call.
- Run extraction evals before changing prompts or models.
- Use provider fallback and rate-limit handling.
- Consider separating streamed chat from asynchronous profile extraction for lower perceived latency.
