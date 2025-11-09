type AlertSeverity = "info" | "warning" | "critical";

export interface AlertEvent {
  title: string;
  message: string;
  severity?: AlertSeverity;
  context?: Record<string, unknown>;
}

interface AlertResult {
  delivered: boolean;
  reason?: string;
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

export async function publishAlert(event: AlertEvent): Promise<AlertResult> {
  const severity = event.severity ?? "info";
  const emoji = SEVERITY_EMOJI[severity];
  const webhook = process.env.SLACK_WEBHOOK_URL;

  if (!webhook) {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[Alert:${severity}] ${event.title} - ${event.message}`, event.context ?? {});
    }
    return { delivered: false, reason: "SLACK_WEBHOOK_URL not configured" };
  }

  try {
    const payload = buildSlackPayload({ ...event, severity, emoji });
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack webhook responded with ${response.status}: ${text}`);
    }

    return { delivered: true };
  } catch (error) {
    console.error("[Alert] Failed to publish alert:", error);
    return {
      delivered: false,
      reason: error instanceof Error ? error.message : "Unknown alert error",
    };
  }
}

function buildSlackPayload(event: AlertEvent & { severity: AlertSeverity; emoji: string }) {
  const contextEntries = event.context ?? {};
  const fields = Object.entries(contextEntries).map(([title, value]) => ({
    title,
    value: formatValue(value),
    short: true,
  }));

  return {
    text: `${event.emoji} ${event.title}`,
    attachments: [
      {
        color: slackColor(event.severity),
        title: event.title,
        text: event.message,
        fields: fields.length > 0 ? fields : undefined,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

function slackColor(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return "#D7263D";
    case "warning":
      return "#FFB400";
    default:
      return "#36C5F0";
  }
}

function formatValue(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "object") {
    try {
      return "```" + JSON.stringify(value, null, 2) + "```";
    } catch {
      return String(value);
    }
  }
  return String(value);
}
