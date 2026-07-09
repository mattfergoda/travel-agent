import { NextResponse } from "next/server";
import { createStorage } from "@/lib/server/storage";
import { getProviderStatus } from "@/lib/server/llm";

export async function GET() {
  const state = await createStorage().load();
  return NextResponse.json({ ...state, provider: getProviderStatus() });
}
