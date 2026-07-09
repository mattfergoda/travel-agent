import { NextResponse } from "next/server";
import { createStorage } from "@/lib/server/storage";

export async function POST() {
  const state = await createStorage().reset();
  return NextResponse.json(state);
}
