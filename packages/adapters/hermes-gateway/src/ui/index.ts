import type { TranscriptEntry, CreateConfigValues } from "@paperclipai/adapter-utils";

export function parseHermesGatewayStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[hermes-gateway:event]")) {
    const match = trimmed.match(/^\[hermes-gateway:event\]\s+(.*)$/s);
    if (match) {
      return [{ kind: "system", ts, text: match[1]! }];
    }
  }

  if (trimmed.startsWith("[hermes-gateway]")) {
    const text = trimmed.replace(/^\[hermes-gateway\]\s*/, "");

    if (text.startsWith("task failed") || text.startsWith("Error") || text.startsWith("error")) {
      return [{ kind: "stderr", ts, text }];
    }

    if (text.startsWith("connected") || text.startsWith("task submitted") || text.startsWith("task completed")) {
      return [{ kind: "system", ts, text }];
    }

    if (text.startsWith("summary:")) {
      return [{ kind: "assistant", ts, text: text.replace("summary: ", "") }];
    }

    return [{ kind: "system", ts, text }];
  }

  return [{ kind: "stdout", ts, text: line }];
}

export function buildHermesGatewayConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.url = v.url;
  ac.timeoutSec = 300;
  ac.heartbeatIntervalSec = 60;
  ac.heartbeatTimeoutSec = 180;
  if (v.apiKey) ac.apiKey = v.apiKey;
  if (v.notifyQQ === "true" || v.notifyQQ === true) {
    ac.notifyQQ = true;
    if (v.qqUserId) ac.qqUserId = v.qqUserId;
  }
  return ac;
}
