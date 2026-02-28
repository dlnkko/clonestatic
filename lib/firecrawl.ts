import Firecrawl from '@mendable/firecrawl-js';

function normalizeApiKey(raw: string): string {
  let key = raw.replace(/\r?\n/g, '').replace(/^\uFEFF/, '').trim();
  key = key.replace(/^["']|["']$/g, '');
  if (key.startsWith('fc-fc-')) key = key.replace('fc-fc-', 'fc-');
  return key.trim();
}

function getFirecrawlInstance() {
  const raw = process.env.FIRECRAWL_API_KEY || '';
  const apiKey = normalizeApiKey(raw);
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart the dev server.');
  }
  if (!apiKey.startsWith('fc-')) {
    throw new Error('FIRECRAWL_API_KEY should start with fc- (get it from https://firecrawl.dev dashboard).');
  }
  return new Firecrawl({ apiKey });
}

export default getFirecrawlInstance;
