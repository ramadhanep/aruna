// Lightweight liveness probe for uptime monitoring. Plain JSON like the
// cron routes — external monitors cannot decode XOR envelopes.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
