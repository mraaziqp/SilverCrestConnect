/**
 * Brings stored copy in line with the code defaults.
 *
 * The hero paragraph, about text, gallery blurb, footer note and welcome pack
 * live in the datastore so the client can edit them in /admin. The constants in
 * src/config/event.ts only seed an empty store — editing them changes nothing
 * for a deployment that has already run. So a copy change made in code silently
 * does not ship, and the live site carries on saying the old thing.
 *
 * This applies the corrections that must not be left half-done:
 *   - "B2B" written out as "business-to-business"
 *   - welcome-pack entries offering a lanyard or business tag, removed
 *   - claims that ALL proceeds go to the drive, softened to "a portion"
 *
 * That last one is why this script warns as well as writes. Only a portion of
 * proceeds now funds the drive, so any surviving "100% of proceeds" is a false
 * statement to donors about their money. The known phrasings are rewritten
 * automatically; anything else making an absolute claim is reported by field
 * name for someone to correct in /admin, rather than guessed at here.
 *
 * It is deliberately surgical rather than a reseed. A reseed would overwrite
 * every edit the client has made in the dashboard; this rewrites only the
 * phrases it was asked to and leaves the rest exactly as found.
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

/** Editable free-text settings fields, in the order they appear on the site. */
const TEXT_FIELDS = [
  'heroParagraph',
  'aboutTitle',
  'aboutLead',
  'aboutBody',
  'galleryHeading',
  'galleryBody',
  'footerNote',
] as const;

/** Phrase-level corrections, applied in order. */
const REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bB2B\b/g, 'business-to-business'],

  [
    /All ticket proceeds and donations go directly towards supplies for the (.+?)\. Nothing is held back for event overheads\./g,
    'A portion of the proceeds from tickets and donations goes towards supplies for the $1.',
  ],
  [
    /100% of ticket proceeds and every donation fund supplies for the (.+?)\. Nothing is retained for event overheads\./g,
    'A portion of the proceeds from tickets and donations goes towards supplies for the $1.',
  ],
  [
    /100% of ticket proceeds and every donation fund supplies for the (.+?)\./g,
    'A portion of the proceeds from tickets and donations goes towards supplies for the $1.',
  ],
  [
    /Every ticket sold directly funds our (.+?) with zero overheads retained\./g,
    'A portion of every ticket sold funds our $1.',
  ],
  [
    /Every rand raised here goes towards supplies for the next drive\./g,
    'A portion of what is raised here goes towards supplies for the next drive.',
  ],
  [/Every rand goes towards supplies for the/g, 'A portion of every donation goes towards supplies for the'],
  [/100% of proceeds go directly towards supplies for the/g, 'A portion of proceeds goes towards supplies for the'],
  [/100% of proceeds fund the/g, 'A portion of proceeds funds the'],
  [/100% of attendance proceeds/g, 'A portion of attendance proceeds'],
  // "100% of X directly fund Y" -> "A portion of X funds Y": the subject turns
  // singular with the rewrite above, so the verb has to follow it.
  [/A portion of attendance proceeds([^.]*?) directly fund /g, 'A portion of attendance proceeds$1 funds '],
  [/Nothing is held back for event overheads\.\s*Every rand reaches the drive\./g, ''],
  [/Nothing is held back for event overheads\./g, ''],
];

/**
 * Wording that still promises the whole amount. Anything matching after the
 * rewrites above needs a human, because the safe correction depends on the
 * sentence it sits in.
 */
const ABSOLUTE_CLAIM = /100%|every rand|nothing is held back|zero overhead|all (ticket )?proceeds/i;

function correct(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REWRITES) out = out.replace(pattern, replacement);
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

function isLanyardItem(item: WelcomePackItem): boolean {
  return /lanyard|business tag|business badge/i.test(`${item.title ?? ''} ${item.body ?? ''}`);
}

async function main(): Promise<void> {
  const driver = chooseStore(process.env);
  const store = await createStore(process.env);

  console.log('\n─── Stored copy ──────────────────────────────────────────────');
  console.log(`  Driver          ${driver}`);
  console.log(`  Mode            ${apply ? 'APPLY — changes will be written' : 'dry run — nothing will be written'}`);

  let changes = 0;
  const warnings: string[] = [];

  // ---- settings ----------------------------------------------------------
  const settings = await store.getSettings();
  const patch: Partial<EventSettings> = {};

  for (const field of TEXT_FIELDS) {
    const before = (settings as Record<string, unknown>)[field];
    if (typeof before !== 'string' || !before) continue;

    const after = correct(before);
    if (after !== before) {
      console.log(`\n  ${field}`);
      console.log(`    before  ${before}`);
      console.log(`    after   ${after}`);
      (patch as Record<string, unknown>)[field] = after;
      changes += 1;
    }

    if (ABSOLUTE_CLAIM.test(after)) {
      warnings.push(`${field}: still promises the full amount — "${after}"`);
    }
  }

  if (Object.keys(patch).length && apply) await store.updateSettings(patch);

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

  // ---- impact items ------------------------------------------------------
  const impact = await store.getImpactItems();
  const impactFixed = impact.map((item) => ({ ...item, body: correct(item.body ?? '') }));

  if (JSON.stringify(impactFixed) !== JSON.stringify(impact)) {
    for (let i = 0; i < impact.length; i += 1) {
      if (impact[i].body !== impactFixed[i].body) {
        console.log(`\n  impactItems[${i}] — ${impact[i].title}`);
        console.log(`    before  ${impact[i].body}`);
        console.log(`    after   ${impactFixed[i].body}`);
        changes += 1;
      }
    }
    if (apply) await store.updateImpactItems(impactFixed);
  }

  for (const item of impactFixed) {
    if (ABSOLUTE_CLAIM.test(item.body ?? '')) {
      warnings.push(`impactItems "${item.title}": still promises the full amount`);
    }
  }

  // ---- result ------------------------------------------------------------
  console.log('\n──────────────────────────────────────────────────────────────');
  if (changes === 0) {
    console.log('  Nothing to change — stored copy already matches.');
  } else if (apply) {
    console.log(`  ${changes} change(s) written.`);
  } else {
    console.log(`  ${changes} change(s) pending. Re-run with --apply to write them.`);
  }

  if (warnings.length) {
    console.log('\n  NEEDS A HUMAN — edit these in /admin:');
    for (const w of warnings) console.log(`    - ${w}`);
    console.log('\n  These still tell donors the whole amount reaches the drive.');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\nFailed:', (err as Error).message, '\n');
  process.exitCode = 1;
});
