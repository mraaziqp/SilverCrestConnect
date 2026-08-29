/**
 * Brings stored copy in line with the code defaults.
 *
 * The hero paragraph, about lead and welcome pack live in the datastore so the
 * client can edit them in /admin. The constants in src/config/event.ts only
 * seed an empty store — editing them changes nothing for a deployment that has
 * already run once. So a copy change made in code silently does not ship, and
 * the site keeps saying the old thing.
 *
 * This applies two specific corrections to what is already stored:
 *   - "B2B" written out as "business-to-business"
 *   - welcome-pack entries offering a lanyard or business tag, removed
 *
 * It is deliberately surgical rather than a reseed. A reseed would overwrite
 * every edit the client has made in the dashboard; this only rewrites the
 * phrases it was asked to, and leaves everything else exactly as found.
 *
 * Usage:
 *   npx tsx scripts/sync-copy.ts              show what would change
 *   npx tsx scripts/sync-copy.ts --apply      write the changes
 *
 * Reads the same env as the server, so it acts on whichever store that env
 * points at. Check which one before using --apply.
 */

import 'dotenv/config';

import { createStore, chooseStore } from '../src/server/store-factory.ts';
import type { EventSettings, WelcomePackItem } from '../src/types.ts';

const apply = process.argv.includes('--apply');

/** Written-out form, preserving the surrounding sentence. */
function expandB2B(text: string): string {
  return text.replace(/\bB2B\b/g, 'business-to-business');
}

/** True for a welcome-pack entry that offers a lanyard or a business tag. */
function isLanyardItem(item: WelcomePackItem): boolean {
  const haystack = `${item.title ?? ''} ${item.body ?? ''}`.toLowerCase();
  return /lanyard|business tag|business badge/.test(haystack);
}

async function main(): Promise<void> {
  const driver = chooseStore(process.env);
  const store = await createStore(process.env);

  console.log(`\n─── Stored copy ──────────────────────────────────────────────`);
  console.log(`  Driver          ${driver}`);
  console.log(`  Mode            ${apply ? 'APPLY — changes will be written' : 'dry run — nothing will be written'}`);

  let changes = 0;

  // ---- settings ----------------------------------------------------------
  const settings = await store.getSettings();
  const patch: Partial<EventSettings> = {};

  for (const field of ['heroParagraph', 'aboutLead', 'aboutTitle', 'aboutBody'] as const) {
    const before = (settings as Record<string, unknown>)[field];
    if (typeof before !== 'string') continue;
    const after = expandB2B(before);
    if (after !== before) {
      console.log(`\n  ${field}`);
      console.log(`    before  ${before}`);
      console.log(`    after   ${after}`);
      (patch as Record<string, unknown>)[field] = after;
      changes += 1;
    }
  }

  if (Object.keys(patch).length && apply) {
    await store.updateSettings(patch);
  }

  // ---- welcome pack ------------------------------------------------------
  const pack = await store.getWelcomePack();
  const kept = pack.filter((item) => !isLanyardItem(item));

  if (kept.length !== pack.length) {
    for (const item of pack.filter(isLanyardItem)) {
      console.log(`\n  welcomePack — removing`);
      console.log(`    ${item.title}`);
    }
    changes += pack.length - kept.length;
    if (apply) await store.updateWelcomePack(kept);
  }

  // ---- result ------------------------------------------------------------
  console.log('\n──────────────────────────────────────────────────────────────');
  if (changes === 0) {
    console.log('  Nothing to change — stored copy already matches.\n');
  } else if (apply) {
    console.log(`  ${changes} change(s) written.\n`);
  } else {
    console.log(`  ${changes} change(s) pending. Re-run with --apply to write them.\n`);
  }
}

main().catch((err) => {
  console.error('\nFailed:', (err as Error).message, '\n');
  process.exitCode = 1;
});
