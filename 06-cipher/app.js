import { encode, decode } from './cipher.js?v=2';
import { emphasisSegments, markdownEmphasis, cipherEmphasis, escapeForDiscord, discordMarkdown } from './format.js?v=5';

const input = document.querySelector('#input');
const output = document.querySelector('#output');
const inputLabel = document.querySelector('#input-label');
const outputLabel = document.querySelector('#output-label');
const clear = document.querySelector('#clear');
const copy = document.querySelector('#copy');
const discordCopy = document.querySelector('#discord-copy');
const copyIcon = copy.querySelector('svg').innerHTML;
const discordPreferenceKey = '06-cipher.discord-copy';
let direction = 'decode';
let outputValue = '';
let outputMarkdownSegments = null;
let copyTimer;
let revision = 0;

try {
  discordCopy.checked = localStorage.getItem(discordPreferenceKey) === 'true';
} catch {
  // The option still works when browser storage is unavailable.
}

function resetCopy() {
  clearTimeout(copyTimer);
  copy.classList.remove('copied');
  copy.setAttribute('aria-label', '変換結果をコピー');
  copy.querySelector('svg').innerHTML = copyIcon;
}

function update() {
  revision += 1;
  let segments;
  if (direction === 'decode') {
    const result = markdownEmphasis(decode(input.value));
    outputValue = result.text;
    segments = result.segments;
    outputMarkdownSegments = result.segments;
  } else {
    outputValue = encode(cipherEmphasis(input.value));
    segments = emphasisSegments(outputValue);
    outputMarkdownSegments = null;
  }
  const fragment = document.createDocumentFragment();
  for (const { text, bold } of segments) {
    if (bold) {
      const strong = document.createElement('strong');
      strong.textContent = text;
      fragment.append(strong);
    } else {
      fragment.append(document.createTextNode(text));
    }
  }
  output.replaceChildren(fragment);
  clear.disabled = !input.value;
  copy.disabled = !outputValue;
  resetCopy();
}

input.addEventListener('input', update);

discordCopy.addEventListener('change', () => {
  revision += 1;
  resetCopy();
  try {
    localStorage.setItem(discordPreferenceKey, String(discordCopy.checked));
  } catch {
    // Storage may be disabled without affecting conversion or copying.
  }
});

document.querySelector('#swap').addEventListener('click', () => {
  direction = direction === 'decode' ? 'encode' : 'decode';
  input.value = outputValue;
  inputLabel.textContent = direction === 'decode' ? '暗号' : 'かな';
  outputLabel.textContent = direction === 'decode' ? 'かな' : '暗号';
  document.querySelector('.mobile-output-label').textContent = outputLabel.textContent;
  input.placeholder = direction === 'decode' ? '暗号を入力' : 'かなを入力';
  update();
  input.focus();
});

clear.addEventListener('click', () => {
  input.value = '';
  update();
  input.focus();
});

copy.addEventListener('click', async () => {
  let text = outputValue;
  if (discordCopy.checked) {
    text = outputMarkdownSegments === null
      ? escapeForDiscord(outputValue)
      : discordMarkdown(outputMarkdownSegments);
  }
  if (!text) return;
  const copiedRevision = revision;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Keep copying available in browsers where the Clipboard API is restricted.
    const field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.className = 'clipboard-fallback';
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    } finally {
      field.remove();
      copy.focus({ preventScroll: true });
    }
    if (!copied) return;
  }
  if (copiedRevision !== revision) return;
  copy.classList.add('copied');
  copy.setAttribute('aria-label', 'コピー済み');
  copy.querySelector('svg').innerHTML = '<path d="m5 12 4 4L19 6" />';
  copyTimer = setTimeout(resetCopy, 1400);
});
