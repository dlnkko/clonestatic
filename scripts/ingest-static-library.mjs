/**
 * Bootstrap or refresh the global static ad library.
 *
 * Usage:
 *   CRON_SECRET=xxx APP_URL=http://localhost:3001 node scripts/ingest-static-library.mjs
 *   CRON_SECRET=xxx APP_URL=https://your-app.vercel.app node scripts/ingest-static-library.mjs refresh
 */
const secret = process.env.CRON_SECRET;
const base = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
const mode = process.argv[2] === 'refresh' ? 'refresh' : 'bootstrap';
const force = process.argv.includes('--force');

if (!secret) {
  console.error('Set CRON_SECRET in the environment.');
  process.exit(1);
}

const url = `${base}/api/admin/ingest-static-library${force ? '?force=1' : ''}`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ mode }),
});

const data = await res.json();
console.log(res.status, JSON.stringify(data, null, 2));
process.exit(res.ok ? 0 : 1);
