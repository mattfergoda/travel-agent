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
  field: TravelProfileSchema.keyof(),
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
  field: TravelProfileSchema.keyof(),
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
