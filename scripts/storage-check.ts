import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';

async function main() {
  const key = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8'));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(key), projectId: key.project_id });
  }

  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET,
    `${key.project_id}.firebasestorage.app`,
    `${key.project_id}.appspot.com`,
  ].filter(Boolean) as string[];

  for (const name of [...new Set(candidates)]) {
    process.stdout.write(`  ${name} ... `);
    try {
      const bucket = getStorage().bucket(name);
      const [exists] = await bucket.exists();
      if (!exists) { console.log('does not exist'); continue; }

      const file = bucket.file(`_probe/${Date.now()}.txt`);
      await file.save('probe', { contentType: 'text/plain' });
      await file.delete();
      console.log('EXISTS and is WRITABLE');
      return;
    } catch (err) {
      console.log('FAILED -', String((err as Error).message).split('\n')[0].slice(0, 140));
    }
  }
  console.log('\n  No usable bucket found.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e?.message ?? e); process.exit(1); });
