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
