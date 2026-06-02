import Whop from '@whop/sdk';

let client: Whop | null = null;

/** Shared Whop API client (server-only). */
export function getWhopClient(): Whop | null {
  const apiKey = process.env.WHOP_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) {
    client = new Whop({
      apiKey,
      webhookKey: process.env.WHOP_WEBHOOK_SECRET?.trim() ?? null,
    });
  }
  return client;
}
