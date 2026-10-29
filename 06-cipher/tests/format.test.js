import test from 'node:test';
import assert from 'node:assert/strict';
import { emphasisSegments, escapeForDiscord } from '../format.js';

test('matched parentheses emphasize their contents while preserving all text', () => {
  assert.deepEqual(emphasisSegments('あ(いう)え'), [
    { text: 'あ', bold: false },
    { text: '(いう)', bold: true },
    { text: 'え', bold: false },
  ]);
  assert.deepEqual(emphasisSegments('（123）'), [{ text: '（123）', bold: true }]);
});

test('nested mixed-width pairs and adjacent ranges combine into a single bold span', () => {
  assert.deepEqual(emphasisSegments('a(い（う）え)(お)b'), [
    { text: 'a', bold: false },
    { text: '(い（う）え)(お)', bold: true },
    { text: 'b', bold: false },
  ]);
  assert.deepEqual(emphasisSegments('()（）'), [{ text: '()（）', bold: true }]);
});

test('unmatched delimiters remain literal and independently matched inner pairs still emphasize', () => {
  assert.deepEqual(emphasisSegments('a(い b） c)'), [{ text: 'a', bold: false }, { text: '(い b） c)', bold: true }]);
  assert.deepEqual(emphasisSegments('a(い b）'), [{ text: 'a(い b）', bold: false }]);
  assert.deepEqual(emphasisSegments('a)い（b'), [{ text: 'a)い（b', bold: false }]);
  assert.deepEqual(emphasisSegments('(あ（い）'), [
    { text: '(あ', bold: false }, { text: '（い）', bold: true },
  ]);
});

test('crossed parentheses never both match across each other', () => {
  assert.deepEqual(emphasisSegments('(あ（い)う）え'), [
    { text: '(あ', bold: false }, { text: '（い)う）', bold: true }, { text: 'え', bold: false },
  ]);
  assert.deepEqual(emphasisSegments('（あ(い）う)え'), [
    { text: '（あ', bold: false }, { text: '(い）う)', bold: true }, { text: 'え', bold: false },
  ]);
});

test('multiline text, literal directives, emoji and HTML-looking input stay exact', () => {
  const source = '***12345\r\n(🙂<script>alert(1)</script>\n99)\t*1';
  const segments = emphasisSegments(source);
  assert.equal(segments.map(({ text }) => text).join(''), source);
  assert.deepEqual(segments, [
    { text: '***12345\r\n', bold: false },
    { text: '(🙂<script>alert(1)</script>\n99)', bold: true },
    { text: '\t*1', bold: false },
  ]);
});

test('empty and unformatted text require no special rendering', () => {
  assert.deepEqual(emphasisSegments(''), []);
  assert.deepEqual(emphasisSegments('あ123🙂'), [{ text: 'あ123🙂', bold: false }]);
});

test('long nested and repeated input preserves text without fragmenting adjacent emphasis', () => {
  const nested = '('.repeat(20000) + 'あ' + ')'.repeat(20000);
  assert.deepEqual(emphasisSegments(nested), [{ text: nested, bold: true }]);
  const repeated = '(あ)'.repeat(20000);
  assert.deepEqual(emphasisSegments(repeated), [{ text: repeated, bold: true }]);
});

test('Discord escaping inserts one backslash before every asterisk including triples', () => {
  assert.equal(escapeForDiscord('*12345'), '\\*12345');
  assert.equal(escapeForDiscord('***12345'), '\\*\\*\\*12345');
  assert.equal(escapeForDiscord('(11)\n*0*0!?'), '(11)\n\\*0\\*0!?');
  assert.equal(escapeForDiscord(''), '');
  assert.equal(escapeForDiscord('plain（あ）'), 'plain（あ）');
});

test('existing backslashes are preserved and one additional backslash precedes each star', () => {
  for (let count = 1; count <= 4; count += 1) {
    const slashes = '\\'.repeat(count);
    assert.equal(escapeForDiscord(slashes + '*1'), slashes + '\\*1');
  }
  const input = String.raw`a\b\*1\\***2`;
  assert.equal(escapeForDiscord(input), String.raw`a\b\\*1\\\*\*\*2`);
});
