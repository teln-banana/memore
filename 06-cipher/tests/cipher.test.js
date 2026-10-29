import test from 'node:test';
import assert from 'node:assert/strict';
import { decode, encode } from '../cipher.js';

test('two-digit rows and columns convert a complete greeting', () => {
  assert.equal(encode('こんにちは'), '2500524261');
  assert.equal(decode('2500524261'), 'こんにちは');
});

test('every supported base kana, small kana, and voiced kana round-trips', () => {
  const alphabet = 'あいうえおかきくけこさしすせそたちつてとなにぬねの' +
    'はひふへほまみむめもやゆよらりるれろわゐゑをん' +
    'ぁぃぅぇぉっゃゅょゎゕゖがぎぐげござじずぜぞだぢづでど' +
    'ばびぶべぼぱぴぷぺぽゔ';
  assert.equal(decode(encode(alphabet)), alphabet);
});

test('small kana prefixes and voice suffixes remain attached to their kana', () => {
  assert.equal(encode('がっこう きゃ ぱぴぷぺぽ ゔ'), '21".432513 22.81 61\'62\'63\'64\'65\' 13"');
  assert.equal(decode('21".432513 22.81 61\'62\'63\'64\'65\' 13"'), 'がっこう きゃ ぱぴぷぺぽ ゔ');
});

test('00 and 99 take priority and repeated specials stay unambiguous', () => {
  assert.equal(encode('んん wwww ww'), '0000 9999 99');
  assert.equal(decode('0000 9999 99'), 'んん wwww ww');
  assert.equal(decode('9995'), 'wwろ');
});

test('alternate zero vowel is accepted while encoding uses five', () => {
  assert.equal(decode('10203040506070809000'), 'おこそとのほもよろん');
  assert.equal(decode('20" 60\' .10'), 'ご ぽ ぉ');
  assert.equal(encode(decode('10203040506070809000')), '15253545556575859500');
});

test('katakana, halfwidth kana, and combining voice marks encode consistently', () => {
  assert.equal(encode('ガッコウ ｶﾞｯｺｳ か\u3099っこう'), '21".432513 21".432513 21".432513');
  assert.equal(encode('パピプペポ ｳﾞ う\u3099'), '61\'62\'63\'64\'65\' 13" 13"');
});

test('only cipher tokens normalize fullwidth digits and modifiers', () => {
  assert.equal(decode('２１＂．４３２５１３ ６１＇ １３゛'), 'がっこう ぱ ゔ');
  assert.equal(decode('２１” ６１’'), 'が ぱ');
  assert.equal(decode('！？，（１１） ＡＢＣ ９'), '！？，（あ） ＡＢＣ ９');
});

test('punctuation, emphasis, whitespace, emoji, and unrelated text are preserved', () => {
  const plain = '(あ)!? -\n\t🙂 漢字 ABC ＡＢＣ ① ｰ';
  const coded = '(11)!? -\n\t🙂 漢字 ABC ＡＢＣ ① ｰ';
  assert.equal(encode(plain), coded);
  assert.equal(decode(coded), plain);
});

test('unsupported and incomplete cipher tokens survive without losing characters', () => {
  const unsupported = '26 82 03 .99 .00 11" 21\' .61 00" ９８ 1 .4';
  assert.equal(decode(unsupported), unsupported);
  assert.equal(decode('123'), 'い3');
  assert.equal(decode('.4!?'), '.4!?');
});

test('unsupported kana combinations do not silently lose their voice mark', () => {
  assert.equal(encode('あ\u3099 ｱﾞ ヷ'), 'あ\u3099 ｱﾞ ヷ');
});

test('empty input stays empty in both directions', () => {
  assert.equal(encode(''), '');
  assert.equal(decode(''), '');
});
