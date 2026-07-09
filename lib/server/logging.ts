export function logEvent(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));
}
