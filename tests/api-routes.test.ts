import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateSchema } from "@/lib/shared/schemas";

const storageState = AppStateSchema.parse({
  profile: { homeLocation: "Austin" },
  messages: [],
  conflicts: [],
});

const load = vi.fn(async () => storageState);
const reset = vi.fn(async () => ({ profile: {}, messages: [], conflicts: [] }));
const save = vi.fn(async () => undefined);

vi.mock("@/lib/server/storage", () => ({
  createStorage: () => ({ load, reset, save }),
}));

beforeEach(() => {
  load.mockClear();
  reset.mockClear();
  save.mockClear();
});

describe("state route", () => {
  it("returns persisted state with provider status", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { GET } = await import("@/app/api/state/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile.homeLocation).toBe("Austin");
    expect(body.provider).toMatchObject({ configured: false, missing: ["OPENROUTER_API_KEY"] });
  });
});

describe("reset route", () => {
  it("resets persisted state", async () => {
    const { POST } = await import("@/app/api/reset/route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reset).toHaveBeenCalled();
    expect(body).toEqual({ profile: {}, messages: [], conflicts: [] });
  });
});

describe("chat route", () => {
  it("rejects invalid chat requests", async () => {
    const { POST } = await import("@/app/api/chat/route");

    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid chat request");
  });

  it("rejects malformed JSON chat requests", async () => {
    const { POST } = await import("@/app/api/chat/route");

    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: "{",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Malformed JSON request");
    expect(load).not.toHaveBeenCalled();
  });

  it("rejects chat requests when provider configuration is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { POST } = await import("@/app/api/chat/route");

    const response = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "I like Tokyo" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing LLM configuration: OPENROUTER_API_KEY");
    expect(load).not.toHaveBeenCalled();
  });
});
