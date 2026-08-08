// Shared helpers for hiding a kanji's answer (the character itself) from
// UI text that would otherwise give it away before a child has tried
// writing it.

// Convert katakana (音読み) to hiragana.
export function katakanaToHiragana(str) {
  return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// A reading to stand in for the kanji character wherever it would
// otherwise be shown as-is (e.g. the "today's kanji" grid tiles).
export function getHiddenAnswerLabel(item) {
  if (item.readings.kunyomi.length > 0) {
    return item.readings.kunyomi[0].replace(/（.*?）/g, '');
  }
  if (item.readings.onyomi.length > 0) {
    return katakanaToHiragana(item.readings.onyomi[0]);
  }
  return '？';
}

// Replaces every occurrence of the kanji character in a piece of example
// text with its reading, so example sentences don't spoil the answer.
export function maskAnswerInText(text, item) {
  if (!text) return text;
  const label = getHiddenAnswerLabel(item);
  return text.split(item.character).join(label);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Same substitution as maskAnswerInText, but returns HTML with the
// substituted reading wrapped in a <mark> so a child can see exactly which
// hiragana stands in for the kanji they're practicing.
export function maskAnswerInHtml(text, item) {
  if (!text) return text;
  const label = getHiddenAnswerLabel(item);
  return text
    .split(item.character)
    .map(escapeHtml)
    .join(`<mark class="masked-reading">${escapeHtml(label)}</mark>`);
}
