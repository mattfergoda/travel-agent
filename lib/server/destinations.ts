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
    .map((destination) => ({
      name: destination.name,
      index: lowerText.indexOf(destination.name.toLowerCase()),
    }))
    .filter((destination) => destination.index !== -1)
    .sort((a, b) => a.index - b.index)
    .map((destination) => destination.name);
}
