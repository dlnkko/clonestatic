# Static Ad Library — checklist

## 1. Supabase

- [ ] Migraciones `010`, `011` (total_impressions), `012` (library_brands_by_category).
- [ ] Bucket `static-ad-library` (público) en Storage.

## 2. Variables `.env.local`

- [ ] `SCRAPECREATORS_API_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `CRON_SECRET` (solo si usas ingest vía HTTP)

## 3. Seeds actuales

~**200 marcas** × 2 (company + brand keyword) + ~**100** keywords genéricos ≈ **~500 seeds**.

Orden de ingest `brand_bootstrap`: companies → brand keywords → genéricos (1 página).

| Modo | Páginas/seed | Créditos estimados | Tope |
|------|--------------|-------------------|------|
| **brand_bootstrap** | company 8, brand kw 4, generic 1 | **~1.800–2.500** | 3500 |
| **brand_refresh** (28 días) | company 2, brand kw 1, generic 1 | **~700–900** | 900 |
| bootstrap (legacy) | 2 | ~360 | 750 |
| refresh (legacy) | 1 | ~179 | 500 |

## 4. Corregir nombres de página Meta (Gemini + Google Search)

Si ScrapeCreators devuelve `No pageId found`, resuelve el nombre exacto de la página:

```bash
npm run resolve-brand-names
# opcional: sondear las 208 marcas (1 crédito c/u)
npm run resolve-brand-names -- --probe
npm run reingest-corrected-brands
```

Correcciones en `lib/static-library/brand-page-corrections.json`. El ingest usa ese nombre para `company` y el label original para `keyword`.

## 5. Validar nombres Meta (opcional)

```bash
npm run validate-seed-names
# o solo 10: npx tsx scripts/validate-seed-names.ts 10
```

## 6. Ingest por marcas (recomendado)

```bash
npm run ingest-library:brands
```

Sin timeout HTTP (horas si hace falta):

```bash
npx tsx scripts/ingest-direct.ts brand_bootstrap
```

Refresh mensual profundo:

```bash
npm run ingest-library:brands:refresh
```

## 7. App

Pestaña **Ad Library** → categoría → **Todos los ads** (mezcla de marcas por impresiones) o **Por marca**.
