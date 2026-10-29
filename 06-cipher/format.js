/**
 * Return text spans for display without changing the underlying cipher text.
 * Only correctly nested ASCII or fullwidth parentheses create emphasis.
 * A mismatched closer remains literal and does not close a different opener.
 */
export function emphasisSegments(value) {
  const source = String(value);
  if (!source) return [];

  const stack = [];
  const changes = new Int32Array(source.length + 1);
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(' || character === '（') {
      stack.push({ index, closer: character === '(' ? ')' : '）' });
    } else if (character === ')' || character === '）') {
      const opener = stack[stack.length - 1];
      if (opener?.closer !== character) continue;
      stack.pop();
      // Preserve the delimiters and emphasize the complete matched range.
      changes[opener.index] += 1;
      changes[index + 1] -= 1;
    }
  }

  const segments = [];
  let depth = 0;
  let start = 0;
  let bold = false;
  for (let index = 0; index < source.length; index += 1) {
    depth += changes[index];
    const nextBold = depth > 0;
    if (nextBold === bold) continue;
    if (index > start) segments.push({ text: source.slice(start, index), bold });
    start = index;
    bold = nextBold;
  }
  segments.push({ text: source.slice(start), bold });
  return segments;
}

/** Add exactly one backslash immediately before every asterisk. */
export function escapeForDiscord(value) {
  return String(value).replace(/\*/g, '\\*');
}

/** Serialize matched emphasis as Markdown while keeping literal stars visible. */
export function markdownEmphasis(value) {
  const source = String(value);
  const stack = [];
  const removed = new Uint8Array(source.length);
  const changes = new Int32Array(source.length + 1);
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(' || character === '（') {
      stack.push({ index, closer: character === '(' ? ')' : '）' });
    } else if (character === ')' || character === '）') {
      const opener = stack[stack.length - 1];
      if (opener?.closer !== character) continue;
      stack.pop();
      // Empty pairs remain visible instead of creating an invisible result.
      if (index === opener.index + 1) continue;
      removed[opener.index] = removed[index] = 1;
      changes[opener.index + 1] += 1;
      changes[index] -= 1;
    }
  }

  const segments = [];
  let depth = 0;
  let bold = false;
  let characters = [];
  for (let index = 0; index < source.length; index += 1) {
    depth += changes[index];
    if (removed[index]) continue;
    const nextBold = depth > 0;
    if (nextBold !== bold && characters.length) {
      segments.push({ text: characters.join(''), bold });
      characters = [];
    }
    bold = nextBold;
    characters.push(source[index]);
  }
  if (characters.length) segments.push({ text: characters.join(''), bold });
  return {
    text: segments.map(({ text, bold }) => bold ? `**${text}**` : text).join(''),
    segments,
  };
}

/** Convert paired, unescaped two-star Markdown delimiters to cipher brackets. */
export function cipherEmphasis(value) {
  const source = String(value);
  const pieces = [];
  let opener = -1;
  let copied = 0;
  for (let index = 0; index < source.length;) {
    if (source[index] !== '*') {
      index += 1;
      continue;
    }
    const start = index;
    while (source[index] === '*') index += 1;
    if (index - start !== 2) continue;
    let slashes = 0;
    for (let before = start - 1; before >= 0 && source[before] === '\\'; before -= 1) slashes += 1;
    if (slashes % 2) continue;
    if (opener === -1) {
      opener = start;
    } else {
      pieces.push(source.slice(copied, opener), '(', source.slice(opener + 2, start), ')');
      copied = index;
      opener = -1;
    }
  }
  pieces.push(source.slice(copied));
  return pieces.join('');
}
