import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

export function HermesGatewayConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Hermes URL" hint="远程 Hermes Agent 的地址">
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "url", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://your-server:9119"
        />
      </Field>

      {isCreate && (
        <SecretField
          label="API Key"
          value={values?.apiKey ?? ""}
          onCommit={(v) => set!({ apiKey: v })}
          placeholder="Hermes API 密钥 (可选)"
        />
      )}

      {!isCreate && (
        <>
          <SecretField
            label="API Key"
            value={eff("adapterConfig", "apiKey", String(config.apiKey ?? ""))}
            onCommit={(v) => mark("adapterConfig", "apiKey", v || undefined)}
            placeholder="Hermes API 密钥"
          />

          <SecretField
            label="Webhook Secret"
            value={eff("adapterConfig", "webhookSecret", String(config.webhookSecret ?? ""))}
            onCommit={(v) => mark("adapterConfig", "webhookSecret", v || undefined)}
            placeholder="Webhook 签名密钥 (可选)"
          />

          <Field label="超时时间 (秒)">
            <DraftInput
              value={eff("adapterConfig", "timeoutSec", String(config.timeoutSec ?? "300"))}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "timeoutSec",
                  Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                );
              }}
              immediate
              className={inputClass}
              placeholder="300"
            />
          </Field>

          <Field label="工作目录">
            <DraftInput
              value={eff("adapterConfig", "workingDirectory", String(config.workingDirectory ?? ""))}
              onCommit={(v) => mark("adapterConfig", "workingDirectory", v || undefined)}
              immediate
              className={inputClass}
              placeholder="/opt/projects (远程工作目录)"
            />
          </Field>

          <Field label="模型">
            <DraftInput
              value={eff("adapterConfig", "model", String(config.model ?? ""))}
              onCommit={(v) => mark("adapterConfig", "model", v || undefined)}
              immediate
              className={inputClass}
              placeholder="auto (使用 Hermes 默认模型)"
            />
          </Field>

          <Field label="最大轮次">
            <DraftInput
              value={eff("adapterConfig", "maxTurns", String(config.maxTurns ?? "90"))}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "maxTurns",
                  Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                );
              }}
              immediate
              className={inputClass}
              placeholder="90"
            />
          </Field>

          <Field label="QQ 通知">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={eff("adapterConfig", "notifyQQ", config.notifyQQ === true) === true}
                  onChange={(e) => mark("adapterConfig", "notifyQQ", e.target.checked || undefined)}
                  className="rounded border-border"
                />
                启用 QQ 通知
              </label>
            </div>
          </Field>

          {config.notifyQQ && (
            <Field label="QQ 用户 ID">
              <DraftInput
                value={eff("adapterConfig", "qqUserId", String(config.qqUserId ?? ""))}
                onCommit={(v) => mark("adapterConfig", "qqUserId", v || undefined)}
                immediate
                className={inputClass}
                placeholder="输入 QQ 号"
              />
            </Field>
          )}

          <Field label="心跳间隔 (秒)">
            <DraftInput
              value={eff("adapterConfig", "heartbeatIntervalSec", String(config.heartbeatIntervalSec ?? "60"))}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "heartbeatIntervalSec",
                  Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                );
              }}
              immediate
              className={inputClass}
              placeholder="60"
            />
          </Field>
        </>
      )}
    </>
  );
}
