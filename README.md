# Static Ad Prompt Generator (standalone)

Web app que clona solo la herramienta **Static Ad Prompt Generator**: subes un anuncio estático de referencia y la imagen de tu producto, y la IA genera un prompt listo para usar en generadores de imágenes (p. ej. Nano Banana Pro).

## Cómo ejecutarla

1. **Copiar variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` y añade:
   - `GOOGLE_GENAI_API_KEY` — obligatorio para generar prompts (Gemini `gemini-3.5-flash` en todo el backend).
   - `FIRECRAWL_API_KEY` — obligatorio si quieres usar "Product URL" (scraping de la página del producto). Si no lo configuras, esa opción fallará; puedes dejar el copywriting en blanco o escribir texto a mano.
   - `SCRAPECREATORS_API_KEY` — obligatorio para la pestaña **Competitor Ads** (búsqueda de anuncios de Facebook/Instagram por categoría).
   - `USE_ADAPTATION_AGENT` — Step 2 de adaptación (opcional):
     - `true` o sin definir → **agente multi-paso** (copy + visual + síntesis + QA). Por defecto.
     - `false` → comportamiento **legacy** (una sola llamada Gemini, como antes).
     - Reinicia el servidor tras cambiar. Ejemplo para desactivar al instante: `USE_ADAPTATION_AGENT=false`
   - `ADAPTATION_AGENT_FALLBACK_LEGACY` — si el agente falla, vuelve al legacy (`true` por defecto).

2. **Instalar dependencias y arrancar**
   ```bash
   npm install
   npm run dev
   ```
   La app se abre en **http://localhost:3001** (puerto distinto al del proyecto principal para no chocar).

3. **Build para producción**
   ```bash
   npm run build
   npm start
   ```

## Qué incluye este clon

- **Lógica y prompts**: misma lógica y prompts que en el proyecto principal (tipografía del reference, brevedad del copy, estilo gráfico vs persona/gym, etc.).
- **API**:
  - `POST /api/generate-static-ad-prompt` — genera el prompt.
  - `POST /api/scrape-url` — scraping de URL de producto (resumen + branding), usado cuando pegas una Product URL.
- **Lib**:
  - `lib/rate-limit.ts` — solo límites para `generateStaticAd` y `scrapeUrl` (in-memory o Upstash si configuras Redis).
  - `lib/firecrawl.ts` — cliente Firecrawl para el scrape.
- **UI**: misma pantalla que la herramienta dentro del dashboard, pero sin sidebar ni login; una sola página con el formulario y el resultado.

## Origen

Clonado desde el proyecto principal (`newgencyapp`). El tool original sigue en:

- `app/tools/static-ad-prompt-generator/page.tsx`
- `app/api/generate-static-ad-prompt/route.ts`
- `app/api/scrape-url/route.ts`

Este folder es independiente: puedes moverlo a otro repo o desplegarlo por separado sin tocar el proyecto principal.
