import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  renderPaperclipWakePrompt,
  buildPaperclipEnv,
} from "@paperclipai/adapter-utils/server-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HermesGatewayConfig {
  url: string;
  apiKey?: string;
  webhookSecret?: string;
  timeoutSec?: number;
  notifyQQ?: boolean;
  qqUserId?: string;
  notifyOnApproval?: boolean;
  notifyOnComplete?: boolean;
  notifyOnError?: boolean;
  workingDirectory?: string;
  maxTurns?: number;
  model?: string;
  promptTemplate?: string;
  heartbeatIntervalSec?: number;
  heartbeatTimeoutSec?: number;
}

interface HermesWebhookResponse {
  ok: boolean;
  taskId?: string;
  sessionId?: string;
  error?: string;
}

interface HermesStatusResponse {
  status: "running" | "idle" | "offline" | "error";
  version?: string;
  model?: string;
  provider?: string;
  uptime?: number;
  activeSessions?: number;
}

interface HermesTaskResult {
  status: "running" | "completed" | "failed" | "cancelled";
  exitCode?: number;
  output?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  summary?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveConfig(ctx: AdapterExecutionContext): HermesGatewayConfig {
  const agentConfig =
    ctx.agent.adapterConfig && typeof ctx.agent.adapterConfig === "object"
      ? (ctx.agent.adapterConfig as Record<string, unknown>)
      : {};

  const config =
    ctx.config && typeof ctx.config === "object"
      ? (ctx.config as Record<string, unknown>)
      : {};

  // Merge: agent-level config takes precedence over instance-level
  const merged = { ...config, ...agentConfig };

  return {
    url: String(merged.url ?? "").replace(/\/+$/, ""),
    apiKey: typeof merged.apiKey === "string" ? merged.apiKey : undefined,
    webhookSecret: typeof merged.webhookSecret === "string" ? merged.webhookSecret : undefined,
    timeoutSec: typeof merged.timeoutSec === "number" ? merged.timeoutSec : 300,
    notifyQQ: merged.notifyQQ === true,
    qqUserId: typeof merged.qqUserId === "string" ? merged.qqUserId : undefined,
    notifyOnApproval: merged.notifyOnApproval !== false,
    notifyOnComplete: merged.notifyOnComplete !== false,
    notifyOnError: merged.notifyOnError !== false,
    workingDirectory: typeof merged.workingDirectory === "string" ? merged.workingDirectory : undefined,
    maxTurns: typeof merged.maxTurns === "number" ? merged.maxTurns : 90,
    model: typeof merged.model === "string" ? merged.model : undefined,
    promptTemplate: typeof merged.promptTemplate === "string" ? merged.promptTemplate : undefined,
    heartbeatIntervalSec: typeof merged.heartbeatIntervalSec === "number" ? merged.heartbeatIntervalSec : 60,
    heartbeatTimeoutSec: typeof merged.heartbeatTimeoutSec === "number" ? merged.heartbeatTimeoutSec : 180,
  };
}

async function httpRequest<T>(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function buildAuthHeaders(config: HermesGatewayConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  if (config.webhookSecret) {
    headers["X-Webhook-Secret"] = config.webhookSecret;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = resolveConfig(ctx);

  if (!config.url) {
    await ctx.onLog("stderr", "[hermes-gateway] Error: url is required in adapter configuration\n");
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "Hermes Gateway URL is not configured",
    };
  }

  const timeoutMs = (config.timeoutSec ?? 300) * 1000;
  const authHeaders = buildAuthHeaders(config);

  // Build the task prompt from Paperclip context
  const wakePrompt = renderPaperclipWakePrompt(ctx);
  const prompt = config.promptTemplate
    ? `${config.promptTemplate}\n\n${wakePrompt}`
    : wakePrompt;

  await ctx.onLog("stdout", `[hermes-gateway] connecting to ${config.url}\n`);

  // Step 1: Check Hermes status
  let hermesStatus: HermesStatusResponse;
  try {
    hermesStatus = await httpRequest<HermesStatusResponse>(
      `${config.url}/api/status`,
      { method: "GET", headers: authHeaders, timeoutMs: 10_000 },
    );
    await ctx.onLog(
      "stdout",
      `[hermes-gateway] connected — status=${hermesStatus.status} version=${hermesStatus.version ?? "unknown"} model=${hermesStatus.model ?? "auto"}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ctx.onLog("stderr", `[hermes-gateway] connection failed: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Failed to connect to Hermes at ${config.url}: ${message}`,
      errorFamily: "transient_upstream",
    };
  }

  // Step 2: Submit task via webhook
  const taskPayload = {
    type: "paperclip_task",
    runId: ctx.runId,
    agentId: ctx.agent.id,
    companyId: ctx.agent.companyId,
    agentName: ctx.agent.name,
    prompt,
    model: config.model,
    maxTurns: config.maxTurns,
    workingDirectory: config.workingDirectory,
    notify: config.notifyQQ
      ? {
          qq: config.qqUserId,
          onApproval: config.notifyOnApproval,
          onComplete: config.notifyOnComplete,
          onError: config.notifyOnError,
        }
      : undefined,
    paperclip: {
      env: buildPaperclipEnv(ctx),
      authToken: ctx.authToken,
      runId: ctx.runId,
    },
  };

  let taskResponse: HermesWebhookResponse;
  try {
    taskResponse = await httpRequest<HermesWebhookResponse>(
      `${config.url}/api/webhook/paperclip`,
      {
        method: "POST",
        headers: authHeaders,
        body: taskPayload,
        timeoutMs: 30_000,
      },
    );

    if (!taskResponse.ok) {
      throw new Error(taskResponse.error ?? "Task submission rejected");
    }

    await ctx.onLog(
      "stdout",
      `[hermes-gateway] task submitted — taskId=${taskResponse.taskId ?? "pending"}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ctx.onLog("stderr", `[hermes-gateway] task submission failed: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Failed to submit task to Hermes: ${message}`,
    };
  }

  // Step 3: Poll for task completion
  const taskId = taskResponse.taskId ?? ctx.runId;
  const pollIntervalMs = 5_000;
  const startTime = Date.now();
  let lastOutput = "";

  await ctx.onLog("stdout", `[hermes-gateway] waiting for task completion (timeout=${config.timeoutSec}s)...\n`);

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    try {
      const result = await httpRequest<HermesTaskResult>(
        `${config.url}/api/webhook/paperclip/result/${taskId}`,
        { method: "GET", headers: authHeaders, timeoutMs: 10_000 },
      );

      // Stream incremental output
      if (result.output && result.output !== lastOutput) {
        const newOutput = result.output.slice(lastOutput.length);
        if (newOutput) {
          await ctx.onLog("stdout", newOutput);
        }
        lastOutput = result.output;
      }

      if (result.status === "completed") {
        await ctx.onLog("stdout", `\n[hermes-gateway] task completed\n`);

        if (result.summary) {
          await ctx.onLog("stdout", `[hermes-gateway] summary: ${result.summary}\n`);
        }

        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          usage: result.usage
            ? {
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
              }
            : undefined,
          summary: result.summary ?? null,
        };
      }

      if (result.status === "failed") {
        await ctx.onLog("stderr", `\n[hermes-gateway] task failed: ${result.error ?? "unknown error"}\n`);
        return {
          exitCode: result.exitCode ?? 1,
          signal: null,
          timedOut: false,
          errorMessage: result.error ?? "Task execution failed on Hermes",
        };
      }

      if (result.status === "cancelled") {
        await ctx.onLog("stdout", `\n[hermes-gateway] task cancelled\n`);
        return {
          exitCode: 1,
          signal: "SIGTERM",
          timedOut: false,
          errorMessage: "Task was cancelled",
        };
      }

      // Still running...
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (elapsed % 30 === 0 && elapsed > 0) {
        await ctx.onLog("stdout", `[hermes-gateway] still running... (${elapsed}s elapsed)\n`);
      }
    } catch {
      // Transient poll error — keep trying
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      await ctx.onLog(
        "stdout",
        `[hermes-gateway] poll error at ${elapsed}s — retrying...\n`,
      );
    }
  }

  // Timeout
  await ctx.onLog("stderr", `[hermes-gateway] task timed out after ${config.timeoutSec}s\n`);
  return {
    exitCode: 1,
    signal: null,
    timedOut: true,
    errorMessage: `Task timed out after ${config.timeoutSec} seconds`,
  };
}
