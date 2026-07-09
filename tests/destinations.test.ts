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
