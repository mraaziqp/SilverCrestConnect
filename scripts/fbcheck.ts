import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

async function main() {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
  const key = JSON.parse(readFileSync(path, 'utf8'));
  initializeApp({ credential: cert(key), projectId: key.project_id });
  const db = getFirestore();

  const ref = db.collection('_connectivity').doc('probe');
  await ref.set({ at: new Date().toISOString(), by: 'claude-setup' });
  const snap = await ref.get();
  console.log('  write+read OK:', JSON.stringify(snap.data()));
  await ref.delete();
  console.log('  delete OK — Firestore is reachable and writable.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('  FAILED:', err?.message ?? err);
  if (String(err?.message).includes('NOT_FOUND')) {
    console.error('\n  Firestore may not be enabled on this project yet.');
    console.error('  Firebase Console -> Build -> Firestore Database -> Create database.');
  }
  process.exit(1);
});
