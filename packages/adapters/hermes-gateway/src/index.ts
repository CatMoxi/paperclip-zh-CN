export const type = "hermes_gateway";
export const label = "Hermes Gateway";

export const models: { id: string; label: string }[] = [
  { id: "mimo-v2.5-pro", label: "Xiaomi MiMo v2.5 Pro" },
  { id: "mimo-v2-omni", label: "Xiaomi MiMo v2 Omni (Vision)" },
  { id: "auto", label: "Auto (use Hermes default)" },
];

export const agentConfigurationDoc = `# hermes_gateway agent configuration

Adapter: hermes_gateway

Use when:
- You have a Hermes Agent instance running on a remote server.
- You want Hermes to act as a "partner" rather than a local subprocess.
- You want Hermes to send QQ/WeChat/Telegram notifications on task events.
- You need remote execution capabilities (e.g. server management, deployment).

Don't use when:
- Hermes is installed locally on the same machine as Paperclip — use hermes_local instead.
- You don't have a running Hermes gateway endpoint.

Core fields:
- url (string, required): Hermes Agent base URL (e.g. http://your-server:9119)
- apiKey (string, optional): Hermes API key for authentication
- webhookSecret (string, optional): shared secret for webhook signature verification
- timeoutSec (number, optional): adapter timeout in seconds (default 300)

Notification fields:
- notifyQQ (boolean, optional): send QQ messages on task start/complete/error (default false)
- qqUserId (string, optional): QQ user ID to notify
- notifyOnApproval (boolean, optional): notify when approval is needed (default true)
- notifyOnComplete (boolean, optional): notify when task completes (default true)
- notifyOnError (boolean, optional): notify when task fails (default true)

Execution fields:
- workingDirectory (string, optional): remote working directory for task execution
- maxTurns (number, optional): maximum agent turns per task (default 90)
- model (string, optional): override Hermes default model for this agent
- promptTemplate (string, optional): custom prompt template for task instructions

Heartbeat fields:
- heartbeatIntervalSec (number, optional): seconds between heartbeat checks (default 60)
- heartbeatTimeoutSec (number, optional): consider offline after this many seconds without heartbeat (default 180)
`;
