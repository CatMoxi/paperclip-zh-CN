# @paperclipai/adapter-hermes-gateway

Hermes Agent Gateway adapter for Paperclip — connects to a remote Hermes Agent instance over HTTP/webhook protocol.

## Overview

Unlike `hermes_local` which runs Hermes as a local CLI process, `hermes_gateway` connects to an **already-running Hermes Agent instance** over HTTP. This makes Hermes a "partner" (合作方) rather than a local employee — similar to how OpenClaw Gateway works.

## Architecture

```
Paperclip Server
  └── hermes_gateway adapter
        ├── POST /webhook → triggers Hermes task execution
        ├── GET /status   → checks Hermes health & heartbeat
        └── GET /result   → polls for task completion
              ↓
        Hermes Agent (remote server)
        ├── hermes webhook subscribe → receives tasks
        ├── hermes gateway → executes tasks via LLM
        └── QQ Bot / other platforms → notifications
```

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Hermes Agent base URL (e.g. `http://160.30.231.34:9119`) |
| `apiKey` | string | ❌ | Hermes API key for authentication |
| `webhookSecret` | string | ❌ | Shared secret for webhook signatures |
| `timeoutSec` | number | ❌ | Request timeout in seconds (default: 300) |
| `notifyQQ` | boolean | ❌ | Send QQ notifications on task events |
| `qqUserId` | string | ❌ | QQ user ID for notifications |

## Usage

1. Ensure Hermes Agent is running on the target server with gateway enabled
2. In Paperclip UI, create a new agent and select "Hermes Gateway" adapter
3. Configure the Hermes URL and credentials
4. Send an invite — Hermes will accept via webhook handshake

## Features

- **Remote execution**: Tasks run on Hermes's server, not Paperclip's
- **QQ notifications**: Hermes can notify you via QQ when tasks need attention
- **Bidirectional**: Hermes reports results back to Paperclip via callback
- **Heartbeat**: Periodic health checks to monitor Hermes status
