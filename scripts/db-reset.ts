/**
 * Wipes application and payment records from the configured database.
 *
 * Editable content (settings, programme, copy) is left alone — the point is
 * to clear test traffic before going live, not to reset the site.
 *
 * Usage: npx tsx scripts/db-reset.ts --yes
 */
import 'dotenv/config';
import { createStore, chooseStore } from '../src/server/store-factory.ts';

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to delete without --yes.');
    console.error('  npx tsx scripts/db-reset.ts --yes');
    process.exit(1);
  }

  const store = await createStore();
  const apps = await store.listApplications();
  const pays = await store.listPayments();
  console.log(`  driver: ${chooseStore()}  |  ${apps.length} applications, ${pays.length} payments`);

  // No bulk delete on the interface, so clear by marking and removing through
  // the same driver the app uses — keeps this honest about what it touches.
  const { RtdbStore, loadRtdbConfig } = await import('../src/server/store-rtdb.ts');
  if (chooseStore() === 'rtdb') {
    const rtdb = new RtdbStore(loadRtdbConfig());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (rtdb as any).db;
    await db.ref('applications').remove();
    await db.ref('payments').remove();
    console.log('  cleared applications and payments.');
  } else {
    console.log('  reset is only implemented for the rtdb driver.');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('  FAILED:', e?.message ?? e);
  process.exit(1);
});
