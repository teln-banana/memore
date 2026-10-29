const ROWS = {
  1: ['あ', 'い', 'う', 'え', 'お'],
  2: ['か', 'き', 'く', 'け', 'こ'],
  3: ['さ', 'し', 'す', 'せ', 'そ'],
  4: ['た', 'ち', 'つ', 'て', 'と'],
  5: ['な', 'に', 'ぬ', 'ね', 'の'],
  6: ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  7: ['ま', 'み', 'む', 'め', 'も'],
  8: ['や', null, 'ゆ', null, 'よ'],
  9: ['ら', 'り', 'る', 'れ', 'ろ'],
  0: ['わ', 'ゐ', null, 'ゑ', 'を'],
};

const SMALL_KANA = {
  あ: 'ぁ', い: 'ぃ', う: 'ぅ', え: 'ぇ', お: 'ぉ',
  つ: 'っ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ', わ: 'ゎ',
  か: 'ゕ', け: 'ゖ',
};

const toCode = new Map([['ん', '00']]);
const fromCode = new Map([['00', 'ん'], ['99', 'ww']]);

for (const [row, kana] of Object.entries(ROWS)) {
  kana.forEach((character, column) => {
    if (!character) return;
    const code = `${row}${column + 1}`;
    toCode.set(character, code);
    fromCode.set(code, character);

    if (SMALL_KANA[character]) {
      toCode.set(SMALL_KANA[character], `.${code}`);
      fromCode.set(`.${code}`, SMALL_KANA[character]);
    }

    for (const [suffix, combiningMark] of [['"', '\u3099'], ["'", '\u309a']]) {
      const modified = (character + combiningMark).normalize('NFC');
      if (modified.length === 1) {
        toCode.set(modified, code + suffix);
        fromCode.set(code + suffix, modified);
      }
    }
  });
}

const VOICE_MARKS = new Map([
  ['\u3099', '\u3099'], ['゛', '\u3099'], ['ﾞ', '\u3099'],
  ['\u309a', '\u309a'], ['゜', '\u309a'], ['ﾟ', '\u309a'],
]);

function isKana(character) {
  return /[\u3041-\u3096\u30a1-\u30fa\uff66-\uff9d]/u.test(character);
}

function normalizeKana(character) {
  return character.normalize('NFKC')
    .replace(/[\u30a1-\u30f6]/gu, (kana) => String.fromCharCode(kana.charCodeAt(0) - 0x60))
    .normalize('NFC');
}

/**
 * Encode supported kana, preserving all other text. Katakana reads as hiragana.
 * The supplied alphabet defines no escaping: literal digits or punctuation next
 * to encoded kana can overlap code syntax, so arbitrary text cannot round-trip.
 */
export function encode(value) {
  const source = String(value);
  let result = '';

  for (let index = 0; index < source.length;) {
    if (source.startsWith('ww', index)) {
      result += '99';
      index += 2;
      continue;
    }

    const character = source[index];
    if (!isKana(character)) {
      result += character;
      index += 1;
      continue;
    }

    let length = 1;
    let normalized = normalizeKana(character);
    const mark = VOICE_MARKS.get(source[index + 1]);
    if (mark) {
      normalized = (normalized + mark).normalize('NFC');
      length += 1;
    }

    result += toCode.get(normalized) ?? source.slice(index, index + length);
    index += length;
  }

  return result;
}

function cipherCharacter(character) {
  if (character === undefined) return '';
  if (/[０-９]/u.test(character)) {
    return String.fromCharCode(character.charCodeAt(0) - 0xfee0);
  }
  if (character === '．') return '.';
  if (['＂', '゛', 'ﾞ', '“', '”'].includes(character)) return '"';
  if (['＇', '゜', 'ﾟ', '‘', '’'].includes(character)) return "'";
  return character;
}

function isDigit(character) {
  return /^[0-9]$/u.test(character);
}

/** Decode complete cipher tokens; preserve incomplete or unsupported tokens. */
export function decode(value) {
  const source = String(value);
  let result = '';

  for (let index = 0; index < source.length;) {
    const start = index;
    const first = cipherCharacter(source[index]);
    const small = first === '.' && isDigit(cipherCharacter(source[index + 1]));
    const digitIndex = index + (small ? 1 : 0);
    const row = cipherCharacter(source[digitIndex]);
    const column = cipherCharacter(source[digitIndex + 1]);

    if (!isDigit(row) || !isDigit(column)) {
      result += source[index];
      index += 1;
      continue;
    }

    index = digitIndex + 2;
    const modifier = cipherCharacter(source[index]);
    const suffix = modifier === '"' || modifier === "'" ? modifier : '';
    if (suffix) index += 1;

    // 00 is always ん, even when 0 also serves as the お column.
    const pair = column === '0' && row !== '0' ? `${row}5` : row + column;
    const token = `${small ? '.' : ''}${pair}${suffix}`;
    result += fromCode.get(token) ?? source.slice(start, index);
  }

  return result;
}
