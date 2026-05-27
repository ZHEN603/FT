import { NextResponse } from "next/server";
import { recordInboundWhatsAppMessage } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "test-token";
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ message: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id?: string;
            from?: string;
            timestamp?: string;
            text?: { body?: string };
            type?: string;
          }>;
        };
      }>;
    }>;
  };
  const messages = payload.entry?.flatMap((entry) => entry.changes ?? [])
    .flatMap((change) => change.value?.messages ?? [])
    .filter((message) => message.from && message.text?.body) ?? [];
  const results = [];
  for (const message of messages) {
    results.push(await recordInboundWhatsAppMessage({
      from: String(message.from),
      text: String(message.text?.body ?? ""),
      externalMessageId: message.id ?? null,
      timestamp: message.timestamp ?? null
    }));
  }
  return NextResponse.json({ ok: true, count: results.length, results });
}
