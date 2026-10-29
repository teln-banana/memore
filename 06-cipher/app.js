import { encode, decode } from './cipher.js';

const input = document.querySelector('#input');
const output = document.querySelector('#output');
const inputLabel = document.querySelector('#input-label');
const outputLabel = document.querySelector('#output-label');
const clear = document.querySelector('#clear');
const copy = document.querySelector('#copy');
const copyIcon = copy.querySelector('svg').innerHTML;
let direction = 'decode';
let copyTimer;
let revision = 0;

function resetCopy() {
  clearTimeout(copyTimer);
  copy.classList.remove('copied');
  copy.setAttribute('aria-label', '変換結果をコピー');
  copy.querySelector('svg').innerHTML = copyIcon;
}

function update() {
  revision += 1;
  output.value = direction === 'decode' ? decode(input.value) : encode(input.value);
  clear.disabled = !input.value;
  copy.disabled = !output.value;
  resetCopy();
}

input.addEventListener('input', update);

document.querySelector('#swap').addEventListener('click', () => {
  direction = direction === 'decode' ? 'encode' : 'decode';
  input.value = output.value;
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
  const text = output.value;
  if (!text) return;
  const copiedRevision = revision;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Keep copying available in browsers where the Clipboard API is restricted.
    const start = output.selectionStart;
    const end = output.selectionEnd;
    output.focus();
    output.select();
    const copied = document.execCommand('copy');
    output.setSelectionRange(start, end);
    copy.focus();
    if (!copied) return;
  }
  if (copiedRevision !== revision) return;
  copy.classList.add('copied');
  copy.setAttribute('aria-label', 'コピー済み');
  copy.querySelector('svg').innerHTML = '<path d="m5 12 4 4L19 6" />';
  copyTimer = setTimeout(resetCopy, 1400);
});
