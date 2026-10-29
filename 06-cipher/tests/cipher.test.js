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

test('single asterisk escapes exactly the next digit, then pairs resume', () => {
  assert.equal(decode('*12345'), '1くと');
  assert.equal(decode('*1*2*3*4*5'), '12345');
  assert.equal(decode('11*1.43 61\'*2 99*0'), 'あ1っ ぱ2 ww0');
  assert.equal(decode('*１２３４５'), '１くと');
  assert.equal(decode('*'), '*');
  assert.equal(decode('*あ *!? **12345'), '*あ *!? *1くと');
});

test('triple asterisk keeps the rest of its line literal and resets on each newline', () => {
  assert.equal(decode('***12345'), '12345');
  assert.equal(decode('***12345\n12345'), '12345\nいせ5');
  assert.equal(decode('***00 99 .43 21" *1 (123)!?'), '00 99 .43 21" *1 (123)!?');
  assert.equal(decode('11***12345\r\n12\r***９９\n00'), 'あ12345\r\nい\r９９\nん');
  assert.equal(decode('***123\u202812\u2029***45'), '123\u2028い\u202945');
  assert.equal(decode('***\n***'), '\n');
  assert.equal(decode('****12345'), '*12345');
});

test('invalid pairs stay intact while subsequent valid pairs still decode', () => {
  assert.equal(decode('0612'), '06い');
  assert.equal(decode('06822612'), '068226い');
  assert.equal(decode('0612\n0612'), '06い\n06い');
});

test('encoding literal digits keeps mixed kana and numbers readable on decoding', () => {
  assert.equal(encode('1くと'), '*12345');
  assert.equal(encode('12345'), '*1*2*3*4*5');
  for (const plain of ['12345', 'あ1い23う', 'ん00 ww99', '１２３ がっこう 456', '(123)!?\n4.5-6']) {
    assert.equal(decode(encode(plain)), plain);
  }
});
