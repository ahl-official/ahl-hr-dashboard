import { NextResponse } from "next/server";
import { checkStorageHealth } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = await checkStorageHealth();
    return NextResponse.json({ status: "healthy", uptime: process.uptime(), timestamp: new Date().toISOString(),
      services: { backend: "connected", storage, pwa: "enabled" } });
  } catch (error: any) {
    return NextResponse.json({ status: "unhealthy", timestamp: new Date().toISOString(),
      services: { backend: "connected", storage: "unavailable", pwa: "enabled" }, error: error?.message || "Storage check failed" }, { status: 503 });
  }
}
