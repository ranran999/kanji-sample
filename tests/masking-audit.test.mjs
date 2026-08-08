import { launchBrowser } from './helpers/browser.mjs';

const BASE = 'http://127.0.0.1:4173';

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(BASE + '/index.html');

  const result = await page.evaluate(async () => {
    const { KANJI_DATA } = await import('/js/data.js');
    const { maskAnswerInText, getHiddenAnswerLabel } = await import('/js/kanjiText.js');

    const leaks = [];
    const emptyLabels = [];
    const noExamples = [];

    for (const k of KANJI_DATA) {
      const label = getHiddenAnswerLabel(k);
      if (label === '？') emptyLabels.push(k.id);

      if (!k.examples || k.examples.length === 0) {
        noExamples.push(k.id);
        continue;
      }
      const ex0 = k.examples[0];
      const maskedSentence = maskAnswerInText(ex0.sentence, k);
      if (maskedSentence.includes(k.character)) {
        leaks.push({ id: k.id, char: k.character, sentence: ex0.sentence, masked: maskedSentence, field: 'examples[0].sentence' });
      }
      const maskedMeaning = maskAnswerInText(k.meaning, k);
      if (maskedMeaning.includes(k.character)) {
        leaks.push({ id: k.id, char: k.character, sentence: k.meaning, masked: maskedMeaning, field: 'meaning' });
      }
      // Sanity: the unmasked sentence should actually CONTAIN the character
      // (otherwise the "masking" never even engaged, which likely means the
      // example was written using a different word than intended).
      if (!ex0.sentence.includes(k.character)) {
        leaks.push({ id: k.id, char: k.character, sentence: ex0.sentence, masked: maskedSentence, field: 'examples[0].sentence -- DOES NOT CONTAIN CHARACTER AT ALL' });
      }
    }

    return { total: KANJI_DATA.length, leaks, emptyLabels, noExamples };
  });

  console.log('Total kanji checked:', result.total);
  console.log('Kanji with no kunyomi/onyomi (label=？):', result.emptyLabels);
  console.log('Kanji with no examples:', result.noExamples);
  console.log('\n-- Masking leaks / issues --');
  if (result.leaks.length === 0) {
    console.log('None found. All examples[0] mask cleanly.');
  } else {
    for (const l of result.leaks) {
      console.log(`  [${l.id}] ${l.char} (${l.field}): "${l.sentence}" -> "${l.masked}"`);
    }
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
