# Process

## Overall Approach

I planned first because the assignment explicitly evaluates judgment, tradeoffs, and process artifacts. The design prioritizes a working, explainable two-hour slice over production infrastructure.

I kept the agentic boundary narrow: the LLM interprets the conversation and proposes profile changes, while application code validates and owns durable state.

This ran across two sessions/tools, both included in `transcripts/`:

1. **`transcripts/01-opencode-gpt5.5-implementation.md`** — opencode on GPT-5.5. I spent an hour working on the high level design, and then an implementation plan using the [Superpowers plugin](https://github.com/obra/superpowers). At the tail end of implementation, I hit the OpenAI usage limit.
2. **`transcripts/02-claude-code-review-and-finishing.jsonl`** — Claude Code. Picked up from there, doing some end-to-end testing, found and fixed a few bugs, ran a smoke test, pushed the repo, and did final polish.

## Time Spent

About 2.5 hours total, over the ~2 hour estimate:

- **~1 hour** — design and implementation planning with opencode (GPT-5.5, high reasoning) using the Superpowers plugin.
- **~1 hour** — development and manual testing.
- **~30 minutes** — combined time navigating model/provider setup and writing this reflection.

Where the overage went: front-loading the design and task plan meant less thrashing during implementation, but the planning itself took longer than expected, and I hit my OpenAI usage limit mid-session as a result (see "What I Would Do Differently Next Time").

## Annotated Prompt Highlights

Quotes and line numbers below refer to `transcripts/01-opencode-gpt5.5-implementation.md`.

1. **Pushing back on my own design instinct: should the model just own the conflict logic? (line 815)**
   My prompt: *"you think it makes sense to do this in-app? Im starting to question not using an agent. Im wondering if we should rely on an agent to detect this and update the profile (with the users consent) rather than writing lots of orchestration logic and deterministic code for doing it. what are the trade-offs and what's your take?"*
   What came back (line 839): *"My take: use a hybrid agentic approach, not a heavy agent framework and not lots of deterministic contradiction logic... conflict handling is exactly where 'just trust the agent' gets risky. The requirement says contradictions must not be silently overwritten. If the LLM is allowed to directly mutate profile state, one bad extraction can fail the core rubric."*
   Kept: the hybrid split — the model proposes patches and conflicts, `lib/server/profile-updates.ts` is the only thing that actually mutates the durable profile and it hard-blocks conflicting fields. This is the single decision the whole conflict-handling story rests on, and I only reached it by questioning my own first instinct out loud.

2. **Provider portability: is OpenRouter actually a commitment? (line 699)**
   My prompt: *"yes that seems right. What if a future dev wanted to use Anthropic instead? would it be plug and play with openrouter?"*
   What came back: routing to Anthropic *through* OpenRouter is close to plug-and-play (swap `LLM_MODEL`, same key/base URL); a *direct* Anthropic API integration is not, because it's a different provider adapter and auth surface entirely.
   Kept: this is exactly why the README's Known Gaps says "Direct Anthropic provider support is not implemented" instead of implying it's a five-minute config change — I'd have written that line wrong without this exchange.

3. **Config overhead gut-check before committing to a provider (line 654)**
   My prompt: *"option 1 is probably right, but how much config overhead will there be (creating accounts, getting API keys, etc.)?"*
   What came back: no Vercel account, no DB setup with JSON persistence, one OpenRouter key, `npm install` + `.env.local` + `npm run dev`. Explicit tradeoff flagged up front: free/cheap OpenRouter models can be flaky, especially with structured output.
   Kept: choosing OpenRouter here wasn't just "it's OpenAI-compatible" — I was checking the actual setup cost before committing, and the flakiness warning turned out to be exactly the bug that ended session 1 (#6 below).

4. **Making myself pin down *where* consent actually happens (line 968)**
   My prompt: *"wait let's continue talking about the question flow. with your suggested approach, where would asking the user for their consent in updating their profile happen?"*
   What came back: two options laid out concretely — ask in the same streamed turn (extraction before streaming, more coherent, costs latency) vs. surface it in the UI after the turn completes (faster, less conversational). Recommendation flipped to extraction-before-streaming specifically because of this question (line 1036): *"despite the extra latency... the assignment specifically cares about conflict handling and whether the assistant respects the user."*
   Kept: extraction-before-streaming, which is why the assistant can say "earlier you mentioned vegetarian, but now steakhouses — should I update that?" in the same reply instead of a generic acknowledgment plus a silent UI flag.

5. **Deliberately not over-building the schema (line 776)**
   My prompt (after being shown the recommended 11-field schema): *"this seems like a great starting schema. we can add to it later if need be once we get this all working."*
   What came back: confirmation to treat it as a 2-hour baseline rather than trying to anticipate every field a "real" travel agent profile might need (no loyalty programs, passport status, or airport codes).
   Kept: the compact schema shipped as-is. This was a conscious scope cut, not something I ran out of time to expand — "get it working first" was the actual reasoning in the moment.

6. **The bug that ended session 1: `generateObject` silently breaking chat (build mode, ~line 8900-8991)**
   Trying to: verify the app actually worked against the real OpenRouter key before calling the build done, instead of trusting green unit tests.
   What came back: a disposable diagnostic script (`diag.mjs`) hit `AI_NoObjectGeneratedError` / `AI_TypeValidationError` on a *trivial* toy schema — proof the AI SDK's `generateObject` structured-output mode itself didn't work against the configured model, not a bug in my extraction schema. Reasoning at line 8991: *"Given robustness is a rubric item ('how robust the app is if you went with a flaky free model'), option 2 is best: use generateText with a prompt instructing strict JSON, then parse and validate with zod. This is what the plan explicitly allowed."*
   Kept: swapped `generateObject` for `generateText` + a hand-rolled JSON parser and `safeParse`. This is the exact "flaky free model" tradeoff the assignment asked me to document, caught only because I insisted on hitting the real provider instead of stopping at green tests.

7. **The actual reason I switched to Claude Code (line 9555)**
   What happened: after fixing #6, restarting the dev server to verify it in a browser kept failing. Self-diagnosis, quoted directly: *"the pkill -f 'next' likely killed the new npm run dev process itself... Actually pkill -f 'next' kills any process with 'next' in command line, including the just-launched npm run dev → next dev. So my pkill kills the server I just started! That's why nothing stays up."*
   Kept: nothing — I hit my OpenAI usage limit right after this, mid-loop, and switched to Claude Code to pick up the verification. This is a usage-limit wall hit mid-debug, not a strategy choice, and I want that on the record rather than smoothed over.

8. **Task 7 review said "clean"; a live smoke test said otherwise (session 2)**
   Trying to: pick up an interrupted review of Task 7 after switching tools.
   What came back: typecheck/test/lint/build all green, matching the existing "review clean" note — but running the real app showed two consecutive unanswered user messages sitting in `data/state.json`, with no assistant reply and no error surfaced anywhere.
   Kept: traced it to the chat route persisting the user's message on a provider failure with zero logging, and to `ChatPane` having no recovery path after an error. Fixed both — failed turns no longer leave a dangling message, and the composer clears/restores the draft instead of getting stuck. Automated checks alone would not have caught this.

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
- The extraction call can still under-populate fields the user clearly mentioned when the model doesn't follow the JSON-only instruction precisely — a failed turn no longer leaves a dangling message (fixed in session 2), but a *succeeded* turn with a sloppy extraction can still miss a field.

## What I Would Do Differently Next Time

- Start development with a smaller model (I used GPT 5.5 on high reasoning) and maybe use a different or custom skill rather than the Superpower plugin. This was my first time using it on a personal project and it's pretty greedy with tokens. Could have avoided having to switch model providers midway through.

## If This Served 10k Requests An Hour

- Use Postgres for profiles, messages, conflicts, and audit trails.
- Add structured tracing for every LLM call and tool call (e.g., a tool like Laminar).
- Run extraction evals before changing prompts or models. Could have automated, agent-based E2E tests, though that may be a bit heavy for this.
- Use provider fallback and rate-limit handling.
- Consider separating streamed chat from asynchronous profile extraction for lower perceived latency.
