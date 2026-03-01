# Whop + Supabase: payments and credits

## Flow

1. **Pay button** → Redirects the user to Whop checkout.
2. **Whop charges** → The user pays on Whop’s page.
3. **Webhook notifies** → Your endpoint receives the event and activates access (email + credits in Supabase).

---

## 1. Webhook URL for Whop

In the Whop dashboard, when configuring the webhook, use:

```
https://YOUR-DOMAIN.com/api/webhooks/whop
```

Replace `YOUR-DOMAIN.com` with your real domain (e.g. `yourapp.vercel.app` or your custom domain).  
Method: **POST**.  
Whop will send events like `payment.succeeded` or `membership.went_valid` to this URL when someone pays.

**Signature verification:** Add your webhook secret to **.env.local** so we can verify requests:

```env
WHOP_WEBHOOK_SECRET=ws_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Use the secret from the Whop dashboard (Settings → Webhooks). If set, the endpoint will reject requests with an invalid or missing signature.

---

## 2. Checkout links (landing)

The landing page uses these checkout URLs by default (no env vars required):

| Plan     | Billing  | URL |
|----------|----------|-----|
| Standard | Monthly  | `https://whop.com/checkout/plan_1qy7pizl7xAkx` |
| Standard | Yearly   | `https://whop.com/checkout/plan_KRjrbQ6Z0D2A5` |
| Pro      | Monthly  | `https://whop.com/checkout/plan_xb9A75BEfcTGk` |
| Pro      | Yearly   | `https://whop.com/checkout/plan_CNk2XegENVQGM` |

To override them with env vars, set:

```env
NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_MONTHLY=...
NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_YEARLY=...
NEXT_PUBLIC_WHOP_CHECKOUT_PRO_MONTHLY=...
NEXT_PUBLIC_WHOP_CHECKOUT_PRO_YEARLY=...
```

---

## 3. Supabase setup

### 3.1 Env vars

In **.env.local** (or your host):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get **SUPABASE_SERVICE_ROLE_KEY** from Supabase → **Settings → API** → “service_role”. Do not expose it to the client.

### 3.2 Create `subscriptions` table

In Supabase → **SQL Editor**, run the contents of:

**supabase/migrations/002_subscriptions_whop.sql**

That creates the `subscriptions` table (`email`, `plan`, `credits_remaining`, `period_end`, etc.).

### 3.3 Plan mapping (already configured)

The webhook maps these Whop plan IDs to credits:

- **Standard (25 credits):** `plan_1qy7pizl7xAkx`, `plan_KRjrbQ6Z0D2A5`
- **Pro (100 credits):** `plan_xb9A75BEfcTGk`, `plan_CNk2XegENVQGM`

No extra env vars are required for this.

---

## 4. What happens when someone pays

1. User clicks a plan on your landing and is sent to Whop checkout.
2. User pays on Whop.
3. Whop sends a **POST** to `https://YOUR-DOMAIN.com/api/webhooks/whop`.
4. The webhook:
   - Verifies the signature (if `WHOP_WEBHOOK_SECRET` is set).
   - Reads the event and the customer email (and plan ID) from the payload.
   - Upserts a row in Supabase `subscriptions`: **email**, **plan** (standard/pro), **credits_remaining** (25 or 100), **period_end**, etc.
5. That user now has access and credits; your app can look them up by email (e.g. **GET /api/subscription?email=...**) and decrement with **POST /api/use-credit** after each generated image.

---

## 5. Giving access in the app (email + credits)

- User goes to **/app**.
- Your app can ask for “Email you paid with” and call **GET /api/subscription?email=...**.
- If the response has `ok: true` and `credits_remaining > 0`, grant access (e.g. set a session cookie with that email).
- Before generating an image, you can show “X credits left” using the same **GET /api/subscription**.
- After each successful image generation, call **POST /api/use-credit** (sending the email in the body or via the session cookie) to subtract 1 credit.
