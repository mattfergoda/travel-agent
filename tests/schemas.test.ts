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
