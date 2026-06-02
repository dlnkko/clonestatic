import { Webhook } from 'standardwebhooks';
import Whop from '@whop/sdk';

/** Verify Whop webhook signatures (supports ws_, whsec_, and SDK unwrap). */
export function verifyAndParseWhopWebhook(
  rawBody: string,
  headers: Headers
): { ok: true; body: Record<string, unknown> } | { ok: false } {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    try {
      return { ok: true, body: JSON.parse(rawBody) as Record<string, unknown> };
    } catch {
      return { ok: false };
    }
  }

  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[key] = value;
  });

  const webhookSecrets = [
    secret,
    Buffer.from(secret, 'utf8').toString('base64'),
    secret.startsWith('ws_') || secret.startsWith('whsec_')
      ? secret.slice(secret.indexOf('_') + 1)
      : null,
  ].filter((s): s is string => Boolean(s));

  for (const key of webhookSecrets) {
    try {
      const wh = new Webhook(key);
      wh.verify(rawBody, headerRecord);
      return { ok: true, body: JSON.parse(rawBody) as Record<string, unknown> };
    } catch {
      try {
        const wh = new Webhook(key, { format: 'raw' });
        wh.verify(rawBody, headerRecord);
        return { ok: true, body: JSON.parse(rawBody) as Record<string, unknown> };
      } catch {
        /* try next */
      }
    }
  }

  try {
    const whop = new Whop({ webhookKey: secret });
    const event = whop.webhooks.unwrap(rawBody, { headers: headerRecord });
    return { ok: true, body: event as unknown as Record<string, unknown> };
  } catch {
    try {
      const whop = new Whop({
        webhookKey: Buffer.from(secret, 'utf8').toString('base64'),
      });
      const event = whop.webhooks.unwrap(rawBody, { headers: headerRecord });
      return { ok: true, body: event as unknown as Record<string, unknown> };
    } catch (err) {
      console.error('Whop webhook: all verification strategies failed', err);
      return { ok: false };
    }
  }
}
