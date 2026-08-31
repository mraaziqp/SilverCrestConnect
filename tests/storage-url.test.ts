/**
 * Applicant photo URLs.
 *
 * The application form uploads photos and then submits the URLs it got back.
 * Nothing stops someone posting a different URL instead, and those URLs are
 * rendered as images inside the admin dashboard — so an arbitrary link would
 * place a remote image, and the request for it carrying the reviewer's IP and
 * referrer, on a page only the team sees.
 *
 * The server therefore accepts only URLs in our own bucket. These pin that
 * down, including the near-misses an attacker would actually try.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isOwnStorageUrl } from '../src/server/storage.ts';

const BUCKET = 'scconect-e1328.firebasestorage.app';

test('accepts a Firebase download URL for our bucket', () => {
  assert.equal(
    isOwnStorageUrl(
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/applications%2F123-abc.jpg?alt=media&token=x`,
      BUCKET,
    ),
    true,
  );
});

test('accepts a plain Cloud Storage URL for our bucket', () => {
  assert.equal(
    isOwnStorageUrl(`https://storage.googleapis.com/${BUCKET}/applications/123-abc.jpg`, BUCKET),
    true,
  );
});

test('rejects another bucket on the same host', () => {
  assert.equal(
    isOwnStorageUrl(
      'https://firebasestorage.googleapis.com/v0/b/someone-elses-bucket/o/evil.jpg',
      BUCKET,
    ),
    false,
  );
  assert.equal(
    isOwnStorageUrl('https://storage.googleapis.com/someone-elses-bucket/evil.jpg', BUCKET),
    false,
  );
});

test('rejects an entirely different host', () => {
  for (const url of [
    'https://evil.example.com/tracker.gif',
    'https://evil.example.com/v0/b/scconect-e1328.firebasestorage.app/o/x.jpg',
  ]) {
    assert.equal(isOwnStorageUrl(url, BUCKET), false, `${url} should be rejected`);
  }
});

test('rejects a host that merely ends with the real one', () => {
  // firebasestorage.googleapis.com.evil.com — the classic suffix trick.
  assert.equal(
    isOwnStorageUrl(
      `https://firebasestorage.googleapis.com.evil.com/v0/b/${BUCKET}/o/x.jpg`,
      BUCKET,
    ),
    false,
  );
});

test('rejects a bucket name that merely starts with ours', () => {
  // The path check must not match scconect-e1328.firebasestorage.app.evil/...
  assert.equal(
    isOwnStorageUrl(
      `https://firebasestorage.googleapis.com/v0/b/${BUCKET}.evil/o/x.jpg`,
      BUCKET,
    ),
    false,
  );
});

test('rejects non-https schemes', () => {
  assert.equal(isOwnStorageUrl(`http://storage.googleapis.com/${BUCKET}/x.jpg`, BUCKET), false);
  assert.equal(isOwnStorageUrl('javascript:alert(1)', BUCKET), false);
  assert.equal(isOwnStorageUrl('data:image/png;base64,iVBORw0KGgo=', BUCKET), false);
});

test('rejects malformed input without throwing', () => {
  for (const url of ['', 'not a url', '//protocol-relative.example.com/x.jpg']) {
    assert.doesNotThrow(() => isOwnStorageUrl(url, BUCKET));
    assert.equal(isOwnStorageUrl(url, BUCKET), false);
  }
});

test('rejects everything when no bucket is configured', () => {
  // With storage unconfigured there is no trusted origin, so nothing qualifies.
  assert.equal(
    isOwnStorageUrl(`https://storage.googleapis.com/${BUCKET}/x.jpg`, ''),
    false,
  );
});
