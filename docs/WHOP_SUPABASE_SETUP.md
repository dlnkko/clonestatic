# Whop + Supabase: payments, auth and credits

## Flow

1. **Subscribe** → User clicks a plan; goes to **/login** (Sign in / Create account with Google).
2. **Google sign-in** → After auth, user is redirected to **checkout-redirect** and then to **Whop checkout**.
3. **Whop charges** → User pays on Whop using the **same email** as their Google account (important for access).
4. **Webhook** → Your endpoint receives the event and upserts **subscriptions** (email, plan, credits).
5. **Access** → User can open **/app**; layout checks session + subscription and credits.

---

## 1. Supabase Auth (Google) – required

### 1.1 Enable Google provider

1. Supabase Dashboard → **Authentication** → **Providers** → **Google** → Enable.
2. Create a Google OAuth client: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client ID (Web application).
3. Add **Authorized redirect URIs** in Google:
   - `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   (Supabase shows this in the Google provider config.)
4. Copy **Client ID** and **Client secret** into Supabase Google provider and Save.

### 1.2 Redirect URLs in Supabase

Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://YOUR-DOMAIN.com` (or `http://localhost:3001` for dev).
- **Redirect URLs:** add both:
  - `https://YOUR-DOMAIN.com/auth/callback**
  - `http://localhost:3001/auth/callback**`

So after Google sign-in, Supabase redirects to your app’s `/auth/callback`, which sets the session and sends the user to checkout or home.

### 1.3 Disable Anonymous sign-in

Supabase → **Authentication** → **Providers** → **Anonymous** → **Disable**.

Only Google (or other providers you add) should be enabled so that every user has a real email we can match to Whop payments.

---

## 2. Webhook URL for Whop

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

## 3. Checkout links (landing)

Subscribe buttons go to **/login?next=checkout&plan=...** (e.g. `plan=standard_monthly`). After Google sign-in, the app redirects to Whop. The API **GET /api/checkout-url?plan=...** (auth required) returns the Whop URL. Defaults (no env vars required):

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

## 4. Supabase setup

### 4.1 Env vars

In **.env.local** (or your host):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get **SUPABASE_SERVICE_ROLE_KEY** from Supabase → **Settings → API** → “service_role”. Do not expose it to the client.

### 4.2 Create `subscriptions` table

In Supabase → **SQL Editor**, run the contents of:

**supabase/migrations/002_subscriptions_whop.sql**

That creates the `subscriptions` table (`email`, `plan`, `credits_remaining`, `period_end`, etc.).

### 4.3 Plan mapping (already configured)

The webhook maps these Whop plan IDs to credits:

- **Standard (20 credits/month):** `plan_1qy7pizl7xAkx`, `plan_KRjrbQ6Z0D2A5`
- **Pro (75 credits/month):** `plan_xb9A75BEfcTGk`, `plan_CNk2XegENVQGM`

Each credit = one generated image or one edit. The webhook sets `credits_remaining` to 20 or 75 when the user subscribes; the app deducts 1 per generation or edit.

No extra env vars are required for this.

---

## 5. Redirect after payment (Success URL) – importante

Para que **tras pagar en Whop el usuario llegue directo al dashboard** de tu web app:

1. En **Whop Dashboard** → tu producto/plan → configuración del checkout.
2. Busca la opción **Success URL**, **Return URL** o **Redirect after payment**.
3. Pon: **`https://TU-DOMINIO.com/app`** (en desarrollo: `http://localhost:3001/app`).

Así el flujo queda: **Elegir plan → Login con Google → Pago en Whop → Redirección automática a /app (dashboard)**.

Si no configuras esta URL, el usuario se quedará en la página de éxito de Whop y tendrá que entrar manualmente a tu sitio y a **/app** (o usar el enlace "Dashboard" del header de la landing).

---

## 6. What happens when someone pays

1. User clicks **Subscribe** on the landing → **/login?next=checkout&plan=...** (Sign in with Google).
2. After Google sign-in → **/auth/callback** → **/checkout-redirect?plan=...** → **Whop checkout**.
3. User pays on Whop; use the **same email** as the Google account so we can match the webhook to the session.
4. Whop redirects to your **Success URL** (e.g. **https://TU-DOMINIO.com/app**) if you set it in step 5 above.
5. Whop sends **POST** to `https://YOUR-DOMAIN.com/api/webhooks/whop`.
6. The webhook verifies the signature, reads email + plan, and upserts **subscriptions** (email, plan, credits_remaining, period_end).
7. User is on **/app** (dashboard); the layout checks Supabase session and subscription; if no credits yet (webhook not processed), a refresh or re-entry after a few seconds will show the app once the webhook has run.

---

## 7. Giving access in the app

- **/app** is protected by **app/app/layout.tsx**: requires Supabase session (Google) and a **subscriptions** row for **user.email** with **credits_remaining ≥ 1**.
- **GET /api/subscription** uses the session (no query param): returns plan and credits for the logged-in user’s email.
- **POST /api/use-credit** uses the session: decrements one credit for the logged-in user’s email.
- **POST /api/generate-ad-image** requires session and deducts one credit before generating; returns 401/402 if not signed in or no credits.

---

## 8. Seguridad en Supabase y en la app

### 8.1 Claves y variables de entorno

- **NEXT_PUBLIC_SUPABASE_URL** y **NEXT_PUBLIC_SUPABASE_ANON_KEY**: pueden estar en el cliente; la anon key está limitada por RLS.
- **SUPABASE_SERVICE_ROLE_KEY**: **nunca** en el cliente. Solo en el servidor (API routes, layout que lee `subscriptions`). Permite bypass de RLS; úsala solo en código de confianza.
- **WHOP_WEBHOOK_SECRET**: solo en el servidor; obligatorio para validar que los POST al webhook vienen de Whop (firma HMAC). Sin él, cualquiera podría enviar peticiones falsas.

### 8.2 Row Level Security (RLS)

- **subscriptions**: RLS **activado** y **sin políticas** para anon/authenticated. Solo el **service_role** (webhook y APIs de servidor) puede leer/escribir. Así ningún usuario ni la anon key pueden ver o modificar suscripciones.
- **creations**: RLS con políticas “Users can read/insert own creations” por `auth.uid()`. Los usuarios solo ven/crean sus propias filas.

### 8.3 Webhook

- Comprobar siempre **webhook-signature** (o el header que use Whop) con **WHOP_WEBHOOK_SECRET** y rechazar si no coincide.
- No confiar en el body sin verificar la firma; evita que alguien active créditos con un POST falso.

### 8.4 Auth y sesión

- Solo **Google** (u otros providers que añadas); **Anonymous** desactivado para que cada usuario tenga un email real y coincida con Whop.
- La app no expone la service_role; las rutas que leen/escriben `subscriptions` usan **createAdminClient()** solo en el servidor (API routes, layout).
- **GET /api/subscription** y **POST /api/use-credit** y **POST /api/generate-ad-image** obtienen el email desde **supabase.auth.getUser()** (sesión en cookies), no desde query o body, para que nadie pueda suplantar a otro usuario.

### 8.5 Resumen rápido

| Qué | Dónde | Acción |
|-----|--------|--------|
| Service role key | Solo servidor (.env.local, Vercel env) | No exponer nunca en cliente |
| Webhook secret | Solo servidor | Validar firma en POST /api/webhooks/whop |
| RLS subscriptions | Supabase | Activado, sin políticas (solo service_role) |
| RLS creations | Supabase | Políticas por auth.uid() |
| Email del usuario | APIs | Siempre de sesión (getUser()), no de query/body |
| Anonymous Auth | Supabase | Desactivado |
| Redirect URLs | Supabase Auth | Solo tu dominio y localhost/auth/callback |
