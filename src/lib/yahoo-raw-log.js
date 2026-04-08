import { mkdir, writeFile } from "fs/promises";
import path from "path";

function sanitizeForFilename(input) {
  return String(input || "unknown")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 64);
}

export async function writeYahooRawLog({
  endpoint,
  symbol,
  requestParams = {},
  payload = null,
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  try {
    const rootDir = process.cwd();
    const logsDir = path.join(rootDir, "logs", "yahoo");
    await mkdir(logsDir, { recursive: true });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const safeEndpoint = sanitizeForFilename(endpoint);
    const safeSymbol = sanitizeForFilename(symbol);
    const fileName = `${timestamp}__${safeEndpoint}__${safeSymbol}.json`;
    const filePath = path.join(logsDir, fileName);

    const record = {
      created_at: now.toISOString(),
      endpoint,
      symbol,
      requestParams,
      payload,
    };

    await writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
  } catch (error) {
    console.warn("Failed to write Yahoo raw log:", error?.message || error);
  }
}

