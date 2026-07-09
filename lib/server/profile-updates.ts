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
