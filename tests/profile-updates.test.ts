import { describe, expect, it } from "vitest";
import { applyExtractionToState } from "@/lib/server/profile-updates";
import type { AppState, ExtractionResult } from "@/lib/shared/schemas";

const baseState = { profile: {}, messages: [], conflicts: [] } as unknown as AppState;
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
    const state = {
      ...baseState,
      profile: { foodPreferences: ["vegetarian"] },
    } as unknown as AppState;

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
