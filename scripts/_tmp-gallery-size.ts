import 'dotenv/config';
import { createStore } from '../src/server/store-factory.ts';
const store = await createStore(process.env);
const gallery = await store.getGallery();
let total = 0;
console.log('  items:', gallery.length);
for (const [i, g] of gallery.entries()) {
  const len = (g.url || '').length;
  total += len;
  const kind = g.url?.startsWith('data:') ? 'INLINE base64' : 'url';
  console.log('   %d. %-14s %8.1f KB  %s', i + 1, kind, len / 1024, (g.url || '').slice(0, 54));
}
console.log('  ----');
console.log('  total gallery payload: %.1f KB', total / 1024);
const sponsors = await store.getSponsors();
let sTotal = 0;
for (const s of sponsors) sTotal += (s.logoUrl || '').length;
console.log('  sponsors: %d, payload %.1f KB', sponsors.length, sTotal / 1024);
