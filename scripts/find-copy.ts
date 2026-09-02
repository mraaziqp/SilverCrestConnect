import 'dotenv/config';
import { createStore } from '../src/server/store-factory.ts';

async function main() {
  const store = await createStore();
  const settings = await store.getSettings() as unknown as Record<string, unknown>;
  const needle = (process.argv[2] ?? 'portion').toLowerCase();

  const hits = Object.entries(settings).filter(
    ([, v]) => typeof v === 'string' && v.toLowerCase().includes(needle),
  );
  if (hits.length === 0) { console.log(`  no stored setting contains "${needle}"`); return; }
  for (const [k, v] of hits) console.log(`  ${k}:\n    ${v}\n`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e?.message ?? e); process.exit(1); });
