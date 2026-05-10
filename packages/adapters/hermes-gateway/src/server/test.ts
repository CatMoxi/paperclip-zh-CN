import type {
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
} from "@paperclipai/adapter-utils";

interface TestContext {
  companyId: string;
  adapterType: string;
  config: Record<string, unknown>;
}

export async function testEnvironment(ctx: TestContext): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = ctx.config ?? {};
  const url = typeof config.url === "string" ? config.url.replace(/\/+$/, "") : "";

  // Check 1: URL is configured
  if (!url) {
    checks.push({
      code: "hermes_gateway_url_missing",
      level: "error",
      message: "Hermes Gateway URL is not configured",
      hint: "Set the 'url' field to your Hermes Agent's base URL (e.g. http://your-server:9119)",
    });
    return {
      adapterType: "hermes_gateway",
      status: "fail",
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "hermes_gateway_url_configured",
    level: "info",
    message: `Hermes Gateway URL: ${url}`,
  });

  // Check 2: Try to reach the Hermes status endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof config.apiKey === "string" && config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${url}/api/status`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      checks.push({
        code: "hermes_gateway_reachable",
        level: "info",
        message: `Hermes Agent is reachable — status: ${data.status ?? "unknown"}, version: ${data.version ?? "unknown"}`,
      });

      if (data.status === "running" || data.status === "idle") {
        checks.push({
          code: "hermes_gateway_healthy",
          level: "info",
          message: "Hermes Agent is healthy and ready to accept tasks",
        });
      } else {
        checks.push({
          code: "hermes_gateway_not_ready",
          level: "warn",
          message: `Hermes Agent status is "${data.status}" — may not be ready for tasks`,
        });
      }
    } else {
      checks.push({
        code: "hermes_gateway_http_error",
        level: "error",
        message: `Hermes responded with HTTP ${response.status}`,
        hint: response.status === 401
          ? "Check your API key configuration"
          : "Ensure Hermes Gateway is running and the URL is correct",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push({
      code: "hermes_gateway_unreachable",
      level: "error",
      message: `Cannot reach Hermes at ${url}: ${message}`,
      hint: "Ensure Hermes Agent is running, the URL is correct, and the network allows connectivity",
    });
  }

  // Check 3: QQ notification configuration
  if (config.notifyQQ === true) {
    if (typeof config.qqUserId === "string" && config.qqUserId) {
      checks.push({
        code: "hermes_gateway_qq_configured",
        level: "info",
        message: `QQ notifications enabled for user: ${config.qqUserId}`,
      });
    } else {
      checks.push({
        code: "hermes_gateway_qq_no_user",
        level: "warn",
        message: "QQ notifications enabled but no qqUserId configured",
        hint: "Set the 'qqUserId' field to receive task notifications via QQ",
      });
    }
  }

  const hasError = checks.some((c) => c.level === "error");
  const hasWarn = checks.some((c) => c.level === "warn");

  return {
    adapterType: "hermes_gateway",
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
