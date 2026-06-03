import Whop from '@whop/sdk';

let client: Whop | null = null;

/** Base64-encode webhook secret for SDK verifier (see docs.whop.com/developer/guides/webhooks). */
function webhookKeyForSdk(): string | null {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!secret) return null;
  return Buffer.from(secret, 'utf8').toString('base64');
}

function createWhopClient(apiKey?: string): Whop {
  return new Whop({
    apiKey: apiKey ?? process.env.WHOP_API_KEY?.trim(),
    webhookKey: webhookKeyForSdk(),
  });
}

/** Whop REST client. Requires WHOP_API_KEY (Company API key). */
export function getWhopClient(): Whop {
  const apiKey = process.env.WHOP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('WHOP_API_KEY is not configured');
  }
  if (!client) {
    client = createWhopClient(apiKey);
  }
  return client;
}

export function getWhopClientOrNull(): Whop | null {
  if (!process.env.WHOP_API_KEY?.trim()) return null;
  return getWhopClient();
}

/** Verify signature + parse webhook body via @whop/sdk (Standard Webhooks). */
export function unwrapWhopWebhook(rawBody: string, headers: Headers): Record<string, unknown> {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return JSON.parse(rawBody) as Record<string, unknown>;
  }

  const headerRecord = Object.fromEntries(headers.entries());

  const attempts: (() => Whop)[] = [
    () => createWhopClient(undefined),
    () => new Whop({ webhookKey: secret }),
    () =>
      new Whop({
        webhookKey: secret.startsWith('ws_') ? secret.slice(3) : secret,
      }),
  ];

  let lastError: unknown;
  for (const build of attempts) {
    try {
      const whop = build();
      const event = whop.webhooks.unwrap(rawBody, { headers: headerRecord });
      return event as unknown as Record<string, unknown>;
    } catch (err) {
      lastError = err;
    }
  }

  console.error('Whop webhook unwrap failed:', lastError);
  throw new Error('Invalid webhook signature');
}
