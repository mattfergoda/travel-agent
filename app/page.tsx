"use client";

import { useEffect, useState } from "react";
import { ChatPane } from "@/components/ChatPane";
import { ProfilePanel } from "@/components/ProfilePanel";
import type { AppState, ProviderStatus } from "@/lib/shared/schemas";

type StateResponse = AppState & { provider: ProviderStatus };

const emptyState: StateResponse = {
  profile: {
    preferredDestinations: [],
    tripTypes: [],
    foodPreferences: [],
    accessibilityNeeds: [],
    travelCompanions: [],
    preferredSeasons: [],
    constraints: [],
    openQuestions: [],
  },
  messages: [],
  conflicts: [],
  provider: { configured: false, model: "", baseUrl: "", missing: ["OPENROUTER_API_KEY"] },
};

export default function Home() {
  const [state, setState] = useState<StateResponse>(emptyState);
  const [isLoading, setIsLoading] = useState(true);

  async function loadState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load profile state");
    return response.json() as Promise<StateResponse>;
  }

  async function refreshState() {
    setState(await loadState());
  }

  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    await refreshState();
  }

  useEffect(() => {
    let isMounted = true;

    loadState()
      .then((nextState) => {
        if (isMounted) setState(nextState);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
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
