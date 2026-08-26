import 'dotenv/config';
import { createStore, chooseStore } from '../src/server/store-factory.ts';

async function main() {
  console.log('  driver selected:', chooseStore());
  const store = await createStore();
  console.log('  connected:', store.driver, '| persistent:', store.isPersistent);

  const settings = await store.getSettings();
  console.log('  settings read OK:', settings.fullName, '|', settings.dateLabel);

  const programme = await store.getProgramme();
  console.log('  programme items:', programme.length);

  const apps = await store.listApplications();
  const pays = await store.listPayments();
  console.log('  applications:', apps.length, '| payments:', pays.length);
  console.log('  seats taken:', await store.countPaidSeats());
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('  FAILED:', e?.message ?? e);
  process.exit(1);
});
