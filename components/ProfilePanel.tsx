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
