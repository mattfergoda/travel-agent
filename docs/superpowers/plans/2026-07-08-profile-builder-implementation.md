# Profile Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-hour scoped Profile Builder web app that streams travel-assistant chat responses, extracts and persists a validated travel profile, calls a stubbed destination tool, and handles conflicting profile updates with user consent.

**Architecture:** Use a lean Next.js App Router app with server-side JSON persistence for one user. The LLM interprets messages and proposes structured updates; server code validates those outputs with zod, owns profile mutation, calls the destination tool, and streams the final assistant response. The client renders chat on the left and read-only profile/conflict state on the right.

**Tech Stack:** Next.js, React, TypeScript, Vercel AI SDK, OpenAI-compatible provider via OpenRouter, zod, Vitest, server-side JSON files.

## Global Constraints

- Optimize for the assignment's ~2 hour implementation budget.
- Use Next.js with TypeScript.
- Use Vercel AI SDK with OpenAI-compatible provider configuration.
- Use OpenRouter as the documented primary provider path.
- Configure provider/model with environment variables and keep secrets out of the repo.
- Validate HTTP, LLM, and persistence boundaries with zod.
- Persist state in server-side JSON files for the single-user assignment scope.
- Implement `async function getDestinationInfo(name: string): Promise<DestinationInfo | null>` with at least five hardcoded destinations.
- Return `null` for unknown destinations and prevent hallucinated destination facts.
- Use extraction-before-streaming so conflicts can be surfaced in the same assistant response.
- The app, not the model, owns durable profile mutation and blocks conflicting updates until user consent.
- Include README.md and PROCESS.md.
- Make small focused commits after each task.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`: strict TypeScript config.
- `next.config.ts`: minimal Next.js config.
- `vitest.config.ts`: Vitest config with path alias support.
- `.gitignore`: ignore dependencies, build outputs, env files, and local JSON state.
- `.env.example`: documented local environment variables without secrets.
- `app/layout.tsx`: root layout metadata.
- `app/page.tsx`: main client page composing chat and profile panel.
- `app/globals.css`: two-column layout and basic visual styling.
- `app/api/chat/route.ts`: chat turn endpoint that validates input, extracts structured updates, calls destination tool, streams assistant text, and persists state.
- `app/api/state/route.ts`: returns current validated app state and provider status.
- `app/api/reset/route.ts`: clears local state for demos.
- `components/ChatPane.tsx`: chat transcript, input form, streaming client logic.
- `components/ProfilePanel.tsx`: read-only profile, conflicts, provider status.
- `lib/shared/schemas.ts`: zod schemas and exported TypeScript types shared by client and server.
- `lib/server/storage.ts`: JSON-file persistence with zod validation.
- `lib/server/destinations.ts`: required `getDestinationInfo` function and mention detection.
- `lib/server/profile-updates.ts`: merge and conflict-resolution state transitions.
- `lib/server/llm.ts`: provider factory, extraction call, assistant streaming call, prompts, and safe missing-credentials behavior.
- `lib/server/logging.ts`: small JSON logger for LLM and tool calls.
- `tests/destinations.test.ts`: destination tool tests.
- `tests/schemas.test.ts`: zod boundary tests.
- `tests/profile-updates.test.ts`: merge/conflict tests.
- `README.md`: setup, config, decisions, known gaps.
- `PROCESS.md`: process narrative and annotated prompt highlights.

---

### Task 1: Scaffold Next.js, TypeScript, Vitest, And Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

**Interfaces:**
- Produces: `npm run dev`, `npm run typecheck`, `npm test`, and `npm run lint` scripts used by all later tasks.
- Produces: `@/*` path alias used by app, lib, and tests.

- [ ] **Step 1: Create package and config files**

Create `package.json` with this content:

```json
{
  "name": "travel-agent-profile-builder",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ai-sdk/openai-compatible": "latest",
    "ai": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@testing-library/react": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `tsconfig.json` with this content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts` with this content:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `vitest.config.ts` with this content:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
```

Create `.gitignore` with this content:

```gitignore
node_modules/
.next/
out/
coverage/
.env
.env.local
.env.*.local
data/
*.log
```

Create `.env.example` with this content:

```bash
OPENROUTER_API_KEY=
LLM_MODEL=openai/gpt-4o-mini
LLM_BASE_URL=https://openrouter.ai/api/v1
```

- [ ] **Step 2: Create the root app shell**

Create `app/layout.tsx` with this content:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Profile Builder",
  description: "A conversational travel profile builder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/globals.css` with this content:

```css
:root {
  color-scheme: light;
  --background: #f6f2ea;
  --panel: #fffaf1;
  --ink: #28231c;
  --muted: #6f6659;
  --line: #dfd3c2;
  --accent: #256f5d;
  --danger: #a5422d;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`

Expected: exits 0 and creates `package-lock.json`.

- [ ] **Step 4: Run baseline verification**

Run: `npm run typecheck`

Expected: exits 0.

Run: `npm test`

Expected: exits 0 with no tests or an empty-suite message accepted by Vitest. If Vitest exits non-zero because no tests exist, continue and verify tests in Task 2.

- [ ] **Step 5: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .gitignore .env.example app/layout.tsx app/globals.css
git commit -m "chore: scaffold profile builder app"
```

---

### Task 2: Shared Zod Schemas And Typed Contracts

**Files:**
- Create: `lib/shared/schemas.ts`
- Create: `tests/schemas.test.ts`

**Interfaces:**
- Produces: `TravelProfileSchema`, `AppStateSchema`, `ExtractionResultSchema`, `ChatRequestSchema`.
- Produces types: `TravelProfile`, `AppState`, `ExtractionResult`, `ChatMessage`, `ProfileConflict`, `DestinationInfo`, `ProviderStatus`.
- Later tasks import these schemas for HTTP, LLM, and persistence validation.

- [ ] **Step 1: Write failing schema tests**

Create `tests/schemas.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { AppStateSchema, ExtractionResultSchema, TravelProfileSchema } from "@/lib/shared/schemas";

describe("shared schemas", () => {
  it("accepts a compact travel profile", () => {
    const parsed = TravelProfileSchema.parse({
      homeLocation: "Chicago",
      preferredDestinations: ["Tokyo"],
      tripTypes: ["food", "culture"],
      budgetLevel: "midRange",
      pace: "balanced",
      lodgingStyle: "boutique hotels",
      foodPreferences: ["vegetarian"],
      accessibilityNeeds: [],
      travelCompanions: ["partner"],
      preferredSeasons: ["fall"],
      constraints: ["avoid red-eye flights"],
      openQuestions: ["preferred trip length"],
    });

    expect(parsed.budgetLevel).toBe("midRange");
  });

  it("rejects malformed extraction output", () => {
    expect(() => ExtractionResultSchema.parse({ profilePatch: { budgetLevel: "expensive" } })).toThrow();
  });

  it("accepts empty initial app state", () => {
    const parsed = AppStateSchema.parse({
      profile: {},
      messages: [],
      conflicts: [],
    });

    expect(parsed.messages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/schemas.test.ts`

Expected: FAIL because `lib/shared/schemas.ts` does not exist.

- [ ] **Step 3: Implement schemas and exported types**

Create `lib/shared/schemas.ts` with this content:

```ts
import { z } from "zod";

export const SeasonSchema = z.enum(["spring", "summer", "fall", "winter"]);
export const BudgetLevelSchema = z.enum(["budget", "midRange", "luxury"]);
export const PaceSchema = z.enum(["relaxed", "balanced", "packed"]);

export const TravelProfileSchema = z.object({
  homeLocation: z.string().min(1).optional(),
  preferredDestinations: z.array(z.string().min(1)).default([]),
  tripTypes: z.array(z.string().min(1)).default([]),
  budgetLevel: BudgetLevelSchema.optional(),
  pace: PaceSchema.optional(),
  lodgingStyle: z.string().min(1).optional(),
  foodPreferences: z.array(z.string().min(1)).default([]),
  accessibilityNeeds: z.array(z.string().min(1)).default([]),
  travelCompanions: z.array(z.string().min(1)).default([]),
  preferredSeasons: z.array(SeasonSchema).default([]),
  constraints: z.array(z.string().min(1)).default([]),
  openQuestions: z.array(z.string().min(1)).default([]),
});

export const DestinationInfoSchema = z.object({
  name: z.string().min(1),
  bestSeasons: z.array(SeasonSchema).min(1),
  knownFor: z.array(z.string().min(1)).min(1),
  averageDailyBudgetUSD: z.object({
    budget: z.number().int().positive(),
    midRange: z.number().int().positive(),
    luxury: z.number().int().positive(),
  }),
  visaNotes: z.string().optional(),
});

export const ChatRoleSchema = z.enum(["user", "assistant"]);

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: ChatRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const ConflictStatusSchema = z.enum(["unresolved", "resolved"]);

export const ProfileConflictSchema = z.object({
  id: z.string().min(1),
  field: z.keyof(TravelProfileSchema.shape),
  existingValue: z.unknown(),
  proposedValue: z.unknown(),
  reason: z.string().min(1),
  status: ConflictStatusSchema,
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  resolution: z.enum(["accepted", "rejected", "keptBoth"]).optional(),
});

export const AppStateSchema = z.object({
  profile: TravelProfileSchema,
  messages: z.array(ChatMessageSchema),
  conflicts: z.array(ProfileConflictSchema),
});

export const ExtractionConflictSchema = z.object({
  field: z.keyof(TravelProfileSchema.shape),
  existingValue: z.unknown(),
  proposedValue: z.unknown(),
  reason: z.string().min(1),
});

export const ExtractionResultSchema = z.object({
  profilePatch: TravelProfileSchema.partial().default({}),
  conflicts: z.array(ExtractionConflictSchema).default([]),
  destinationMentions: z.array(z.string().min(1)).default([]),
  resolvedConflictIds: z.array(z.string().min(1)).default([]),
  notesForAssistant: z.string().default(""),
});

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export const ProviderStatusSchema = z.object({
  configured: z.boolean(),
  model: z.string(),
  baseUrl: z.string(),
  missing: z.array(z.string()),
});

export type Season = z.infer<typeof SeasonSchema>;
export type BudgetLevel = z.infer<typeof BudgetLevelSchema>;
export type Pace = z.infer<typeof PaceSchema>;
export type TravelProfile = z.infer<typeof TravelProfileSchema>;
export type DestinationInfo = z.infer<typeof DestinationInfoSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ProfileConflict = z.infer<typeof ProfileConflictSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
```

- [ ] **Step 4: Run schema tests**

Run: `npm test -- tests/schemas.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: exits 0.

- [ ] **Step 6: Commit shared contracts**

```bash
git add lib/shared/schemas.ts tests/schemas.test.ts
git commit -m "feat: define profile builder contracts"
```

---

### Task 3: JSON Persistence Layer

**Files:**
- Create: `lib/server/storage.ts`
- Create: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `AppState`, `AppStateSchema` from `lib/shared/schemas.ts`.
- Produces: `emptyAppState(): AppState`.
- Produces: `createStorage(options?: { filePath?: string }): { load(): Promise<AppState>; save(state: AppState): Promise<void>; reset(): Promise<AppState>; }`.
- Later API routes use `createStorage()` with default file path.

- [ ] **Step 1: Write failing storage tests**

Create `tests/storage.test.ts` with this content:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/storage.test.ts`

Expected: FAIL because `lib/server/storage.ts` does not exist.

- [ ] **Step 3: Implement storage**

Create `lib/server/storage.ts` with this content:

```ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppStateSchema, type AppState } from "@/lib/shared/schemas";

const DEFAULT_STATE_PATH = join(process.cwd(), "data", "state.json");

export function emptyAppState(): AppState {
  return AppStateSchema.parse({
    profile: {},
    messages: [],
    conflicts: [],
  });
}

export function createStorage(options: { filePath?: string } = {}) {
  const filePath = options.filePath ?? DEFAULT_STATE_PATH;

  return {
    async load(): Promise<AppState> {
      let raw: string;

      try {
        raw = await readFile(filePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return emptyAppState();
        }

        throw error;
      }

      const parsedJson: unknown = JSON.parse(raw);
      const parsedState = AppStateSchema.safeParse(parsedJson);

      if (!parsedState.success) {
        throw new Error(`Stored app state failed validation: ${parsedState.error.message}`);
      }

      return parsedState.data;
    },

    async save(state: AppState): Promise<void> {
      const parsedState = AppStateSchema.parse(state);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(parsedState, null, 2)}\n`, "utf8");
    },

    async reset(): Promise<AppState> {
      await rm(filePath, { force: true });
      return emptyAppState();
    },
  };
}
```

- [ ] **Step 4: Run storage tests**

Run: `npm test -- tests/storage.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Run all tests and typecheck**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: exits 0.

- [ ] **Step 6: Commit persistence layer**

```bash
git add lib/server/storage.ts tests/storage.test.ts
git commit -m "feat: persist app state in json"
```

---

### Task 4: Destination Tool And Mention Detection

**Files:**
- Create: `lib/server/destinations.ts`
- Create: `tests/destinations.test.ts`

**Interfaces:**
- Consumes: `DestinationInfo` from `lib/shared/schemas.ts`.
- Produces: `async function getDestinationInfo(name: string): Promise<DestinationInfo | null>`.
- Produces: `detectKnownDestinations(text: string): string[]`.
- Later chat route calls both functions.

- [ ] **Step 1: Write failing destination tests**

Create `tests/destinations.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { detectKnownDestinations, getDestinationInfo } from "@/lib/server/destinations";

describe("getDestinationInfo", () => {
  it("returns hardcoded data for a known destination", async () => {
    const tokyo = await getDestinationInfo("tokyo");
    expect(tokyo).toMatchObject({
      name: "Tokyo",
      bestSeasons: expect.arrayContaining(["spring", "fall"]),
      knownFor: expect.arrayContaining(["food"]),
    });
  });

  it("returns null for unknown destinations", async () => {
    await expect(getDestinationInfo("Atlantis")).resolves.toBeNull();
  });

  it("detects known destinations in free text", () => {
    expect(detectKnownDestinations("Could we compare Lisbon and Mexico City?"))
      .toEqual(["Lisbon", "Mexico City"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/destinations.test.ts`

Expected: FAIL because `lib/server/destinations.ts` does not exist.

- [ ] **Step 3: Implement destination tool**

Create `lib/server/destinations.ts` with this content:

```ts
import type { DestinationInfo } from "@/lib/shared/schemas";

const DESTINATIONS: DestinationInfo[] = [
  {
    name: "Tokyo",
    bestSeasons: ["spring", "fall"],
    knownFor: ["food", "design", "transit", "neighborhood wandering"],
    averageDailyBudgetUSD: { budget: 90, midRange: 220, luxury: 550 },
    visaNotes: "US travelers can typically visit Japan visa-free for short tourism stays; verify before travel.",
  },
  {
    name: "Paris",
    bestSeasons: ["spring", "fall"],
    knownFor: ["art", "architecture", "food", "walkable neighborhoods"],
    averageDailyBudgetUSD: { budget: 110, midRange: 260, luxury: 650 },
    visaNotes: "Part of the Schengen Area; visa needs depend on passport and trip length.",
  },
  {
    name: "Mexico City",
    bestSeasons: ["spring", "fall", "winter"],
    knownFor: ["food", "museums", "history", "nightlife"],
    averageDailyBudgetUSD: { budget: 60, midRange: 150, luxury: 400 },
  },
  {
    name: "Reykjavik",
    bestSeasons: ["summer", "winter"],
    knownFor: ["nature", "hot springs", "northern lights", "road trips"],
    averageDailyBudgetUSD: { budget: 140, midRange: 300, luxury: 700 },
    visaNotes: "Part of the Schengen Area; winter driving may require extra planning.",
  },
  {
    name: "Lisbon",
    bestSeasons: ["spring", "fall", "summer"],
    knownFor: ["food", "views", "coast", "architecture"],
    averageDailyBudgetUSD: { budget: 75, midRange: 170, luxury: 420 },
    visaNotes: "Part of the Schengen Area; visa needs depend on passport and trip length.",
  },
];

const BY_LOWER_NAME = new Map(DESTINATIONS.map((destination) => [destination.name.toLowerCase(), destination]));

export async function getDestinationInfo(name: string): Promise<DestinationInfo | null> {
  return BY_LOWER_NAME.get(name.trim().toLowerCase()) ?? null;
}

export function detectKnownDestinations(text: string): string[] {
  const lowerText = text.toLowerCase();
  return DESTINATIONS
    .filter((destination) => lowerText.includes(destination.name.toLowerCase()))
    .map((destination) => destination.name);
}
```

- [ ] **Step 4: Run destination tests**

Run: `npm test -- tests/destinations.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Run all tests and typecheck**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: exits 0.

- [ ] **Step 6: Commit destination tool**

```bash
git add lib/server/destinations.ts tests/destinations.test.ts
git commit -m "feat: add destination info tool"
```

---

### Task 5: Profile Merge And Conflict State Transitions

**Files:**
- Create: `lib/server/profile-updates.ts`
- Create: `tests/profile-updates.test.ts`

**Interfaces:**
- Consumes: `AppState`, `ExtractionResult`, `ProfileConflict`, `TravelProfile`.
- Produces: `applyExtractionToState(state: AppState, extraction: ExtractionResult, now?: Date): AppState`.
- Later chat route uses `applyExtractionToState` before streaming assistant response.

- [ ] **Step 1: Write failing profile update tests**

Create `tests/profile-updates.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { applyExtractionToState } from "@/lib/server/profile-updates";
import type { AppState, ExtractionResult } from "@/lib/shared/schemas";

const baseState: AppState = { profile: {}, messages: [], conflicts: [] };
const now = new Date("2026-07-08T12:00:00.000Z");

describe("applyExtractionToState", () => {
  it("applies safe scalar and array profile updates", () => {
    const extraction: ExtractionResult = {
      profilePatch: {
        homeLocation: "Austin",
        preferredDestinations: ["Tokyo"],
        tripTypes: ["food"],
      },
      conflicts: [],
      destinationMentions: [],
      resolvedConflictIds: [],
      notesForAssistant: "",
    };

    const next = applyExtractionToState(baseState, extraction, now);

    expect(next.profile.homeLocation).toBe("Austin");
    expect(next.profile.preferredDestinations).toEqual(["Tokyo"]);
    expect(next.profile.tripTypes).toEqual(["food"]);
  });

  it("does not overwrite a conflicting field", () => {
    const state: AppState = {
      ...baseState,
      profile: { foodPreferences: ["vegetarian"] },
    };

    const extraction: ExtractionResult = {
      profilePatch: { foodPreferences: ["steakhouses"] },
      conflicts: [{
        field: "foodPreferences",
        existingValue: ["vegetarian"],
        proposedValue: ["steakhouses"],
        reason: "User previously said vegetarian but now asked for steakhouses.",
      }],
      destinationMentions: [],
      resolvedConflictIds: [],
      notesForAssistant: "",
    };

    const next = applyExtractionToState(state, extraction, now);

    expect(next.profile.foodPreferences).toEqual(["vegetarian"]);
    expect(next.conflicts).toHaveLength(1);
    expect(next.conflicts[0]).toMatchObject({ field: "foodPreferences", status: "unresolved" });
  });

  it("marks conflicts resolved when the extraction references their ids", () => {
    const state: AppState = {
      ...baseState,
      conflicts: [{
        id: "conflict-1",
        field: "foodPreferences",
        existingValue: ["vegetarian"],
        proposedValue: ["steakhouses"],
        reason: "Diet contradiction.",
        status: "unresolved",
        createdAt: now.toISOString(),
      }],
    };

    const extraction: ExtractionResult = {
      profilePatch: {},
      conflicts: [],
      destinationMentions: [],
      resolvedConflictIds: ["conflict-1"],
      notesForAssistant: "",
    };

    const next = applyExtractionToState(state, extraction, now);

    expect(next.conflicts[0]).toMatchObject({ status: "resolved", resolvedAt: now.toISOString() });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/profile-updates.test.ts`

Expected: FAIL because `lib/server/profile-updates.ts` does not exist.

- [ ] **Step 3: Implement profile update logic**

Create `lib/server/profile-updates.ts` with this content:

```ts
import type { AppState, ExtractionResult, ProfileConflict, TravelProfile } from "@/lib/shared/schemas";

const ARRAY_FIELDS: Array<keyof TravelProfile> = [
  "preferredDestinations",
  "tripTypes",
  "foodPreferences",
  "accessibilityNeeds",
  "travelCompanions",
  "preferredSeasons",
  "constraints",
  "openQuestions",
];

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function conflictId(field: string, createdAt: string, index: number): string {
  return `${field}-${createdAt}-${index}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

function mergeProfile(profile: TravelProfile, patch: Partial<TravelProfile>, blockedFields: Set<keyof TravelProfile>): TravelProfile {
  const next: TravelProfile = { ...profile };

  for (const field of ARRAY_FIELDS) {
    if (blockedFields.has(field)) continue;
    const patchValue = patch[field];
    if (Array.isArray(patchValue)) {
      const existingValue = Array.isArray(next[field]) ? next[field] as string[] : [];
      (next as Record<string, unknown>)[field] = uniqueStrings([...existingValue, ...patchValue.map(String)]);
    }
  }

  for (const field of ["homeLocation", "budgetLevel", "pace", "lodgingStyle"] as Array<keyof TravelProfile>) {
    if (blockedFields.has(field)) continue;
    const patchValue = patch[field];
    if (patchValue !== undefined && (next[field] === undefined || next[field] === "")) {
      (next as Record<string, unknown>)[field] = patchValue;
    }
  }

  return next;
}

export function applyExtractionToState(state: AppState, extraction: ExtractionResult, now = new Date()): AppState {
  const timestamp = now.toISOString();
  const resolvedIds = new Set(extraction.resolvedConflictIds);
  const blockedFields = new Set(extraction.conflicts.map((conflict) => conflict.field));

  const resolvedConflicts = state.conflicts.map((conflict): ProfileConflict => {
    if (!resolvedIds.has(conflict.id) || conflict.status === "resolved") {
      return conflict;
    }

    return {
      ...conflict,
      status: "resolved",
      resolvedAt: timestamp,
      resolution: "keptBoth",
    };
  });

  const newConflicts: ProfileConflict[] = extraction.conflicts.map((conflict, index) => ({
    id: conflictId(conflict.field, timestamp, index),
    field: conflict.field,
    existingValue: conflict.existingValue,
    proposedValue: conflict.proposedValue,
    reason: conflict.reason,
    status: "unresolved",
    createdAt: timestamp,
  }));

  return {
    ...state,
    profile: mergeProfile(state.profile, extraction.profilePatch, blockedFields),
    conflicts: [...resolvedConflicts, ...newConflicts],
  };
}
```

- [ ] **Step 4: Run profile update tests**

Run: `npm test -- tests/profile-updates.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Run all tests and typecheck**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: exits 0.

- [ ] **Step 6: Commit profile update logic**

```bash
git add lib/server/profile-updates.ts tests/profile-updates.test.ts
git commit -m "feat: apply validated profile updates"
```

---

### Task 6: LLM Provider, Prompts, Logging, And API Routes

**Files:**
- Create: `lib/server/logging.ts`
- Create: `lib/server/llm.ts`
- Create: `app/api/state/route.ts`
- Create: `app/api/reset/route.ts`
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: schemas, storage, destinations, and profile update functions from earlier tasks.
- Produces: `getProviderStatus(): ProviderStatus`.
- Produces: `extractFromMessage(input): Promise<ExtractionResult>`.
- Produces: `streamAssistantResponse(input): Promise<Response>`.
- Produces API routes used by the UI.

- [ ] **Step 1: Create JSON logger**

Create `lib/server/logging.ts` with this content:

```ts
export function logEvent(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));
}
```

- [ ] **Step 2: Implement LLM provider and prompt helpers**

Create `lib/server/llm.ts` with this content:

```ts
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
```

- [ ] **Step 3: Implement state route**

Create `app/api/state/route.ts` with this content:

```ts
import { NextResponse } from "next/server";
import { createStorage } from "@/lib/server/storage";
import { getProviderStatus } from "@/lib/server/llm";

export async function GET() {
  const state = await createStorage().load();
  return NextResponse.json({ ...state, provider: getProviderStatus() });
}
```

- [ ] **Step 4: Implement reset route**

Create `app/api/reset/route.ts` with this content:

```ts
import { NextResponse } from "next/server";
import { createStorage } from "@/lib/server/storage";

export async function POST() {
  const state = await createStorage().reset();
  return NextResponse.json(state);
}
```

- [ ] **Step 5: Implement chat route**

Create `app/api/chat/route.ts` with this content:

```ts
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
  const requestJson: unknown = await request.json();
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
```

- [ ] **Step 6: Confirm assistant message persistence behavior**

Review `app/api/chat/route.ts` and confirm the route uses `streamAndPersist({ stream: stream.textStream, storage, state: nextState })`. The persistence behavior should be:

- chunks stream to the client as they arrive.
- assistant text accumulates server-side.
- after the stream completes, `storage.save` persists `nextState.messages` plus the assistant message.
- the client refreshes `/api/state` after the stream and sees both user and assistant messages.

- [ ] **Step 7: Run verification**

Run: `npm run typecheck`

Expected: exits 0. If package API names have changed, adjust imports and method names to the installed AI SDK documentation, then rerun until typecheck exits 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit API and LLM orchestration**

```bash
git add lib/server/logging.ts lib/server/llm.ts app/api/state/route.ts app/api/reset/route.ts app/api/chat/route.ts
git commit -m "feat: orchestrate chat turns"
```

---

### Task 7: Two-Column Chat And Profile UI

**Files:**
- Create: `components/ChatPane.tsx`
- Create: `components/ProfilePanel.tsx`
- Create: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `GET /api/state`, `POST /api/chat`, `POST /api/reset` from Task 6.
- Consumes: `AppState`, `ProviderStatus` types.
- Produces: visible chat UI, streamed assistant text, persisted profile panel refresh after stream, reset control.

- [ ] **Step 1: Create profile panel component**

Create `components/ProfilePanel.tsx` with this content:

```tsx
import type { AppState, ProviderStatus, TravelProfile } from "@/lib/shared/schemas";

function ValueList({ values }: { values: string[] | undefined }) {
  if (!values || values.length === 0) return <span className="muted">Not captured yet</span>;
  return <span>{values.join(", ")}</span>;
}

function Scalar({ value }: { value: string | undefined }) {
  return <span>{value || <span className="muted">Not captured yet</span>}</span>;
}

function profileRows(profile: TravelProfile) {
  return [
    ["Home", <Scalar key="home" value={profile.homeLocation} />],
    ["Destinations", <ValueList key="destinations" values={profile.preferredDestinations} />],
    ["Trip types", <ValueList key="tripTypes" values={profile.tripTypes} />],
    ["Budget", <Scalar key="budget" value={profile.budgetLevel} />],
    ["Pace", <Scalar key="pace" value={profile.pace} />],
    ["Lodging", <Scalar key="lodging" value={profile.lodgingStyle} />],
    ["Food", <ValueList key="food" values={profile.foodPreferences} />],
    ["Accessibility", <ValueList key="accessibility" values={profile.accessibilityNeeds} />],
    ["Companions", <ValueList key="companions" values={profile.travelCompanions} />],
    ["Seasons", <ValueList key="seasons" values={profile.preferredSeasons} />],
    ["Constraints", <ValueList key="constraints" values={profile.constraints} />],
    ["Open questions", <ValueList key="openQuestions" values={profile.openQuestions} />],
  ] as const;
}

export function ProfilePanel({ state, provider, onReset }: { state: AppState; provider: ProviderStatus; onReset: () => void }) {
  const unresolved = state.conflicts.filter((conflict) => conflict.status === "unresolved");

  return (
    <aside className="profile-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Durable profile</p>
          <h2>Travel preferences</h2>
        </div>
        <button className="secondary-button" onClick={onReset}>Reset</button>
      </div>

      <section className="status-card">
        <strong>{provider.configured ? "LLM configured" : "Setup needed"}</strong>
        <span>{provider.model}</span>
        {!provider.configured && <span className="danger">Missing: {provider.missing.join(", ")}</span>}
      </section>

      <dl className="profile-grid">
        {profileRows(state.profile).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="conflicts">
        <h3>Needs clarification</h3>
        {unresolved.length === 0 ? (
          <p className="muted">No unresolved conflicts.</p>
        ) : (
          unresolved.map((conflict) => (
            <article className="conflict-card" key={conflict.id}>
              <strong>{conflict.field}</strong>
              <p>{conflict.reason}</p>
            </article>
          ))
        )}
      </section>
    </aside>
  );
}
```

- [ ] **Step 2: Create chat pane component**

Create `components/ChatPane.tsx` with this content:

```tsx
"use client";

import { FormEvent, useState } from "react";
import type { ChatMessage } from "@/lib/shared/schemas";

type LocalMessage = Pick<ChatMessage, "id" | "role" | "content">;

export function ChatPane({ messages, onTurnComplete }: { messages: ChatMessage[]; onTurnComplete: () => Promise<void> }) {
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleMessages = [...messages, ...localMessages];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) return;

    setDraft("");
    setError(null);
    setIsSending(true);

    const userMessage: LocalMessage = { id: crypto.randomUUID(), role: "user", content: message };
    const assistantMessage: LocalMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setLocalMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: "Chat request failed" }));
        throw new Error(payload.error ?? "Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setLocalMessages((current) => current.map((item) => item.id === assistantMessage.id ? { ...item, content: item.content + chunk } : item));
      }

      await onTurnComplete();
      setLocalMessages([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chat failed");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="chat-pane">
      <div className="chat-header">
        <p className="eyebrow">Profile Builder</p>
        <h1>Tell Atlas how you like to travel</h1>
        <p>Chat naturally. The profile panel updates with durable preferences and flags contradictions.</p>
      </div>

      <div className="messages">
        {visibleMessages.length === 0 && (
          <div className="empty-state">Try: "I live in Denver, like food trips, and I am considering Tokyo in the fall."</div>
        )}
        {visibleMessages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <strong>{message.role === "user" ? "You" : "Atlas"}</strong>
            <p>{message.content || "..."}</p>
          </article>
        ))}
      </div>

      {error && <p className="error-banner">{error}</p>}

      <form className="composer" onSubmit={submit}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Share a travel preference or ask about a destination..." />
        <button disabled={isSending}>{isSending ? "Sending" : "Send"}</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 3: Create main page**

Create `app/page.tsx` with this content:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ChatPane } from "@/components/ChatPane";
import { ProfilePanel } from "@/components/ProfilePanel";
import type { AppState, ProviderStatus } from "@/lib/shared/schemas";

type StateResponse = AppState & { provider: ProviderStatus };

const emptyState: StateResponse = {
  profile: {},
  messages: [],
  conflicts: [],
  provider: { configured: false, model: "", baseUrl: "", missing: ["OPENROUTER_API_KEY"] },
};

export default function Home() {
  const [state, setState] = useState<StateResponse>(emptyState);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load profile state");
    setState(await response.json());
  }

  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    await refreshState();
  }

  useEffect(() => {
    refreshState().finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <main className="app-shell"><p>Loading profile...</p></main>;
  }

  return (
    <main className="app-shell">
      <ChatPane messages={state.messages} onTurnComplete={refreshState} />
      <ProfilePanel state={state} provider={state.provider} onReset={reset} />
    </main>
  );
}
```

- [ ] **Step 4: Add layout CSS**

Append this content to `app/globals.css`:

```css
.app-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr);
  gap: 24px;
  min-height: 100vh;
  padding: 24px;
}

.chat-pane,
.profile-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: 0 18px 50px rgba(61, 48, 33, 0.08);
}

.chat-pane {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 48px);
  overflow: hidden;
}

.chat-header,
.panel-header,
.conflicts,
.status-card {
  padding: 20px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

.messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding: 20px;
}

.message {
  max-width: 78%;
  padding: 14px 16px;
  border-radius: 16px;
  background: #eee4d3;
}

.message.user {
  align-self: flex-end;
  background: #dcebe5;
}

.message.assistant {
  align-self: flex-start;
}

.message p {
  margin: 8px 0 0;
  white-space: pre-wrap;
}

.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  border-top: 1px solid var(--line);
  padding: 16px;
}

.composer textarea {
  min-height: 72px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px;
}

.composer button,
.secondary-button {
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  font-weight: 700;
  padding: 10px 18px;
}

.secondary-button {
  background: #efe3d0;
  color: var(--ink);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.status-card {
  display: grid;
  gap: 6px;
  margin: 0 20px 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: white;
}

.profile-grid {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0 20px 20px;
}

.profile-grid div {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

dd {
  margin: 4px 0 0;
}

.muted {
  color: var(--muted);
}

.danger,
.error-banner {
  color: var(--danger);
}

.error-banner {
  padding: 0 20px;
}

.conflict-card,
.empty-state {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: white;
  padding: 14px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run UI verification**

Run: `npm run typecheck`

Expected: exits 0.

Run: `npm run build`

Expected: exits 0. If build fails because `next lint` is unavailable in the installed Next version, remove the `lint` script or replace it with `eslint .`, then rerun build and typecheck.

- [ ] **Step 6: Commit UI**

```bash
git add components/ChatPane.tsx components/ProfilePanel.tsx app/page.tsx app/globals.css
git commit -m "feat: add chat and profile interface"
```

---

### Task 8: README, PROCESS, And Final Verification

**Files:**
- Create: `README.md`
- Create: `PROCESS.md`
- Modify: code files only if final verification exposes issues.

**Interfaces:**
- Consumes: final app behavior and design spec.
- Produces: reviewer-facing setup and process artifacts required by the assignment.

- [ ] **Step 1: Create README**

Create `README.md` with this content, then update the model name if a different one was used during manual testing:

```md
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
```

- [ ] **Step 2: Create PROCESS.md**

Create `PROCESS.md` with this content and adjust the prompt highlights to match the final exported transcript:

```md
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
```

- [ ] **Step 3: Run final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: exits 0.

Run: `npm run build`

Expected: exits 0.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

Expected: Next.js starts on `http://localhost:3000`.

In the browser, verify these scenarios:

- Without `.env.local`, the page loads and chat shows a missing-key error.
- With valid `.env.local`, message "I live in Denver, like food trips, and I am considering Tokyo in the fall" streams a response and updates profile state after completion.
- Reload the page and confirm the profile persists.
- Message "Actually I want great steakhouses" after vegetarian preferences creates an unresolved conflict instead of silently replacing the food preference.
- Message about an unknown destination produces an assistant response that does not invent destination facts.

- [ ] **Step 5: Commit docs and final fixes**

```bash
git add README.md PROCESS.md
git commit -m "docs: explain setup and process"
```

- [ ] **Step 6: Inspect final history and status**

Run: `git status --short`

Expected: no output.

Run: `git log --oneline -10`

Expected: focused commits showing design, scaffold, contracts, persistence, destination tool, profile updates, API, UI, and docs.

---

## Self-Review Notes

- Spec coverage: tasks cover scaffold, typed contracts, zod validation, JSON persistence, destination tool, extraction-before-streaming, conflict blocking, UI, README, PROCESS, and verification.
- Risk to watch during execution: AI SDK package APIs can shift. If typecheck fails, prefer small local fixes to provider factory or stream response usage rather than broad rewrites.
