"use server";

import { NextResponse } from "next/server";

const VALID_CATEGORIES = ["idx", "us", "crypto"];

function resolveBaseUrl() {
  if (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.length > 0) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL.length > 0) {
    return `https://${process.env.VERCEL_URL}`;
  }
}

function buildErrorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request, context) {
  const authorization = request.headers.get("Authorization");
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return buildErrorResponse("Unauthorized", 401);
  }

  const params = await context?.params;
  const category = params?.category?.toLowerCase();
  if (!VALID_CATEGORIES.includes(category)) {
    return buildErrorResponse("Unknown screener category", 400);
  }

  const baseUrl = resolveBaseUrl();
  const targetUrl = `${baseUrl}/api/screeners/${category}`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "aruna-cron",
      },
    });
    const payloadText = await response.text();
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      payload = payloadText;
    }

    return NextResponse.json(
      {
        triggered: response.ok,
        category,
        status: response.status,
        payload,
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    console.error("Cron trigger failed", error);
    return buildErrorResponse("Failed to reach screener", 502);
  }
}
