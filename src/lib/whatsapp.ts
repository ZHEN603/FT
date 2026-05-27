export type WhatsAppSendResult = {
  ok: boolean;
  status: "sent" | "pending" | "failed";
  externalId: string | null;
  error: string | null;
  fallbackUrl: string;
};

export function normalizeWhatsapp(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function buildWhatsappUrl(phone: string, text: string) {
  const normalized = normalizeWhatsapp(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export async function sendWhatsAppText(phone: string, text: string): Promise<WhatsAppSendResult> {
  const fallbackUrl = buildWhatsappUrl(phone, text);
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const normalized = normalizeWhatsapp(phone);

  if (!token || !phoneNumberId || !normalized) {
    return {
      ok: false,
      status: "pending",
      externalId: null,
      error: !normalized ? "Missing WhatsApp recipient." : "WhatsApp Cloud API is not configured.",
      fallbackUrl
    };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalized,
        type: "text",
        text: { preview_url: true, body: text }
      })
    });
    const data = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        externalId: null,
        error: data.error?.message ?? `WhatsApp API failed with ${response.status}`,
        fallbackUrl
      };
    }
    return {
      ok: true,
      status: "sent",
      externalId: data.messages?.[0]?.id ?? null,
      error: null,
      fallbackUrl
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      externalId: null,
      error: error instanceof Error ? error.message : "WhatsApp API request failed.",
      fallbackUrl
    };
  }
}
