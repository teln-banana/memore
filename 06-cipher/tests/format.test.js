import test from 'node:test';
import assert from 'node:assert/strict';
import { emphasisSegments, escapeForDiscord, markdownEmphasis, cipherEmphasis, discordMarkdown } from '../format.js';
import { encode, decode } from '../cipher.js';

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

test('parenthesized decoded text becomes Markdown with separate bold display spans', () => {
  assert.deepEqual(markdownEmphasis('あ(いう)え'), {
    text: 'あ**いう**え',
    segments: [{ text: 'あ', bold: false }, { text: 'いう', bold: true }, { text: 'え', bold: false }],
  });
  assert.deepEqual(markdownEmphasis('（123）'), {
    text: '**123**', segments: [{ text: '123', bold: true }],
  });
  assert.deepEqual(markdownEmphasis(''), { text: '', segments: [] });
});

test('nested and adjacent emphasis flattens without leaving extra star runs', () => {
  assert.deepEqual(markdownEmphasis('a(い（う）え)(お)b'), {
    text: 'a**いうえお**b',
    segments: [{ text: 'a', bold: false }, { text: 'いうえお', bold: true }, { text: 'b', bold: false }],
  });
  assert.equal(markdownEmphasis('('.repeat(20000) + 'あ' + ')'.repeat(20000)).text, '**あ**');
});

test('empty and unmatched parentheses remain literal while matched inner pairs convert', () => {
  assert.deepEqual(markdownEmphasis('()（）(あ'), {
    text: '()（）(あ', segments: [{ text: '()（）(あ', bold: false }],
  });
  assert.deepEqual(markdownEmphasis('(あ（い）'), {
    text: '(あ**い**', segments: [{ text: '(あ', bold: false }, { text: 'い', bold: true }],
  });
  assert.equal(markdownEmphasis('(あ（い)う）え').text, '(あ**い)う**え');
});

test('literal Markdown-looking stars remain visible and unbold in decoded output', () => {
  assert.deepEqual(markdownEmphasis('**あ**\r\n(い) *1'), {
    text: '**あ**\r\n**い** *1',
    segments: [{ text: '**あ**\r\n', bold: false }, { text: 'い', bold: true }, { text: ' *1', bold: false }],
  });
  assert.deepEqual(markdownEmphasis(decode('***abc**def**')), {
    text: 'abc**def**', segments: [{ text: 'abc**def**', bold: false }],
  });
});

test('paired exact double-star delimiters convert back to cipher parentheses', () => {
  assert.equal(cipherEmphasis('あ**いう**え'), 'あ(いう)え');
  assert.equal(cipherEmphasis('**あ** **い**'), '(あ) (い)');
  assert.equal(cipherEmphasis('**あ\nい**'), '(あ\nい)');
  assert.equal(cipherEmphasis('**あ** trailing **'), '(あ) trailing **');
  assert.equal(cipherEmphasis(''), '');
});

test('single stars, triple runs, escaped delimiters and unmatched markers stay literal', () => {
  for (const source of ['*12345', '***12345', '***あ***', '****あ****', '**あ', String.raw`\**あ**`, String.raw`**あ\**`]) {
    assert.equal(cipherEmphasis(source), source);
  }
  assert.equal(cipherEmphasis(String.raw`\\**あ**`), String.raw`\\(あ)`);
});

test('Markdown emphasis round-trips through the numeric cipher and Discord escaping', () => {
  assert.equal(markdownEmphasis(decode('(11)')).text, '**あ**');
  assert.equal(encode(cipherEmphasis('**あ**')), '(11)');
  const natural = '前**あ123**後';
  const coded = encode(cipherEmphasis(natural));
  assert.equal(coded, '前(11*1*2*3)後');
  assert.equal(markdownEmphasis(decode(coded)).text, natural);
  assert.equal(discordMarkdown(markdownEmphasis(decode('(11)')).segments), '**あ**');
  assert.equal(markdownEmphasis(decode('*12345\n***12345\n0612')).text, '1くと\n12345\n06い');
});

test('Discord copying preserves generated bold markers and escapes only literal stars', () => {
  const result = markdownEmphasis('前(あ*い)後*');
  assert.equal(result.text, '前**あ*い**後*');
  assert.equal(discordMarkdown(result.segments), '前**あ\\*い**後\\*');
  assert.equal(discordMarkdown(markdownEmphasis('（あ（い）う）').segments), '**あいう**');
  assert.equal(discordMarkdown(markdownEmphasis('(あ) (い)').segments), '**あ** **い**');
  assert.equal(discordMarkdown([]), '');
});

test('literal double and triple stars are escaped even beside genuine emphasis', () => {
  const result = markdownEmphasis('**raw** (あ) ***1');
  assert.equal(discordMarkdown(result.segments), '\\*\\*raw\\*\\* **あ** \\*\\*\\*1');
  assert.equal(discordMarkdown(markdownEmphasis(decode('***abc**def**')).segments), 'abc\\*\\*def\\*\\*');
});

test('numeric stars inside emphasized text are escaped without altering the wrapper', () => {
  const result = markdownEmphasis(decode('(11) ***literal*1'));
  assert.equal(discordMarkdown(result.segments), '**あ** literal\\*1');
  assert.equal(escapeForDiscord(encode(cipherEmphasis('**あ**1'))), '(11)\\*1');
});
