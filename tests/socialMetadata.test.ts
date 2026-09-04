import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';

function meta(name: string): string {
  const tags = [...head.matchAll(/<meta\s+[^>]*>/g)]
    .map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])))
    .filter((attrs) => (attrs.property ?? attrs.name) === name);
  assert.equal(tags.length, 1, `Expected exactly one ${name} tag in static HTML`);
  assert.ok(tags[0].content?.trim(), `Missing content for ${name}`);
  return tags[0].content;
}

test('social cards reference the same static public image with meaningful metadata', () => {
  const page = new URL(meta('og:url'));
  const image = new URL(meta('og:image'));
  assert.equal(page.href, 'https://4ai4me.github.io/earthquake_cloud/');
  assert.equal(image.origin, page.origin);
  assert.ok(image.pathname.startsWith(`${page.pathname}assets/`));
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:locale'), 'ko_KR');
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.equal(meta('twitter:image'), image.href);
  assert.equal(meta('twitter:image:alt'), meta('og:image:alt'));
  assert.ok(meta('og:image:alt').length > 10);
  assert.equal(meta('og:image:type'), 'image/jpeg');
  assert.ok(image.pathname.endsWith('.jpg'));

  const relativePath = image.pathname.slice(page.pathname.length);
  const bytes = readFileSync(new URL(`../public/${relativePath}`, import.meta.url));
  assert.ok(bytes.length > 0 && bytes.length < 5_000_000);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Image must actually be JPEG');
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, 'JPEG must be complete');

  // Read the JPEG frame header without adding an image-processing dependency.
  for (let offset = 2; offset + 3 < bytes.length;) {
    assert.equal(bytes[offset++], 0xff, 'Invalid JPEG marker');
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    assert.notEqual(marker, 0xda, 'JPEG frame header must precede scan data');
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= bytes.length, 'Invalid JPEG segment');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      assert.ok(length >= 8);
      const width = bytes.readUInt16BE(offset + 5);
      const height = bytes.readUInt16BE(offset + 3);
      assert.equal(width, 1200);
      assert.equal(height, 630);
      assert.equal(meta('og:image:width'), String(width));
      assert.equal(meta('og:image:height'), String(height));
      return;
    }
    offset += length;
  }
  assert.fail('JPEG dimensions not found');
});
