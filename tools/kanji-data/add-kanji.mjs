// Adds new kanji to public/js/data.js from plain text input (character, category,
// readings, meaning, example sentences) -- no worksheet photo needed. This
// covers the case where you already know exactly which kanji you want to
// add (e.g. from a textbook table of contents, or just typing them in)
// rather than extracting them from a photo (see docs/adding-a-kanji-theme.md
// for that workflow).
//
// The KanjiVG stroke data (shape, start/end points, hint text) is still
// generated automatically, same as generate-stroke-data.mjs. What this tool
// adds on top is: validating the example sentences against this app's
// answer-masking logic (public/js/kanjiText.js) *before* merging, so the class of
// bugs found during the original worksheet-photo import (a reading that
// doesn't match the masked sentence, an example sentence missing the kanji
// entirely, etc.) gets caught here instead of after publishing.
//
// Usage:
//   node tools/kanji-data/add-kanji.mjs --input new-kanji.json
//     Dry run: fetches KanjiVG data, validates, and prints the ready-to-review
//     public/js/data.js snippet -- does not touch any files.
//
//   node tools/kanji-data/add-kanji.mjs --input new-kanji.json --write
//     Same, but also inserts the validated entries directly into public/js/data.js.
//
// Input JSON shape (see tools/kanji-data/add-kanji.example.json):
//   {
//     "newCategories": [
//       { "id": "lake", "name": "...", "emoji": "🏞️", "description": "...",
//         "gradient": "linear-gradient(135deg, #xxxxxx, #xxxxxx)" }
//     ],
//     "kanji": [
//       {
//         "character": "湖",
//         "id": "mizuumi",                 // optional; defaults to k<codepoint>
//         "category": "lake",              // must exist, or be in newCategories above
//         "grade": 2,                      // optional; defaults to 2
//         "readings": { "onyomi": ["コ"], "kunyomi": ["みずうみ"] },
//         "meaning": "みずうみ",
//         "examples": [
//           { "word": "湖（みずうみ）", "reading": "みずうみ", "sentence": "山の中に 湖が ある。" }
//         ]
//       }
//     ]
//   }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processCharacter, toCodepoint } from './generate-stroke-data.mjs';
import { launchBrowser } from '../../tests/helpers/browser.mjs';
import { getHiddenAnswerLabel } from '../../public/js/kanjiText.js';
import { KANJI_DATA, KANJI_CATEGORIES } from '../../public/js/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_JS_PATH = path.join(__dirname, '..', '..', 'public', 'js', 'data.js');

function q(str) {
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function validateEntry(entry, existingCharacters, categoryIds, seenCharacters) {
  const problems = [];
  const warnings = [];

  if (!entry.character || Array.from(entry.character).length !== 1) {
    problems.push(`"character" must be exactly one kanji, got ${JSON.stringify(entry.character)}`);
    return { problems, warnings };
  }
  if (existingCharacters.has(entry.character)) {
    problems.push(`${entry.character} is already in public/js/data.js -- pass --force to add anyway (will create a duplicate)`);
  }
  if (seenCharacters.has(entry.character)) {
    problems.push(`${entry.character} appears more than once in this input file`);
  }
  if (!entry.category || !categoryIds.has(entry.category)) {
    problems.push(`category ${JSON.stringify(entry.category)} does not exist -- add it to "newCategories" or use an existing id (${[...categoryIds].join(', ')})`);
  }
  const onyomi = entry.readings?.onyomi ?? [];
  const kunyomi = entry.readings?.kunyomi ?? [];
  if (onyomi.length === 0 && kunyomi.length === 0) {
    problems.push('readings.onyomi and readings.kunyomi are both empty -- need at least one reading');
  }
  if (!entry.meaning) {
    problems.push('"meaning" is required');
  }
  if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
    problems.push('"examples" must have at least one entry');
    return { problems, warnings };
  }

  const ex0 = entry.examples[0];
  if (!ex0.sentence || !ex0.sentence.includes(entry.character)) {
    problems.push(`examples[0].sentence does not contain the character ${entry.character} at all -- only examples[0] is ever shown, so it must contain the real kanji`);
  }
  if (problems.length === 0) {
    // Only examples[0] is ever rendered (kanjiInfoCard.js), so only its
    // masking-correctness matters. Verify the reading actually used to
    // mask the kanji (the first onyomi/kunyomi entry) is the one that
    // makes sense for this specific example.
    const label = getHiddenAnswerLabel({ readings: { onyomi, kunyomi } });
    const bareWordMatch = ex0.word && ex0.word.match(new RegExp(`^${entry.character}（(.+)）$`));
    if (bareWordMatch) {
      const wordReading = bareWordMatch[1];
      if (wordReading !== label) {
        problems.push(
          `examples[0] reads "${entry.character}" as "${wordReading}" but the masked sentence will show "${label}" (order readings.onyomi/kunyomi so the intended reading is first)`
        );
      }
    } else {
      warnings.push(
        `examples[0].word ("${ex0.word ?? '?'}") looks like a compound word -- can't auto-verify the masked reading reads naturally. Watch out for rendaku/sound changes (e.g. 小刀=こがたな) that the masking can't represent; double-check by eye.`
      );
    }
  }

  return { problems, warnings };
}

function formatExample(ex) {
  return `{ word: ${q(ex.word)}, reading: ${q(ex.reading)}, sentence: ${q(ex.sentence)} }`;
}

function formatStroke(s) {
  return `{ strokeNumber: ${s.strokeNumber}, type: ${q(s.type)}, start: { x: ${s.start.x}, y: ${s.start.y} }, end: { x: ${s.end.x}, y: ${s.end.y} }, svgPath: ${q(s.svgPath)}, hintText: ${q(s.hintText)} }`;
}

function formatKanjiEntry(entry) {
  const onyomi = entry.readings.onyomi.map(q).join(', ');
  const kunyomi = entry.readings.kunyomi.map(q).join(', ');
  const examples = entry.examples.map((ex) => `      ${formatExample(ex)},`).join('\n');
  const strokes = entry.strokes.map((s) => `      ${formatStroke(s)},`).join('\n');
  return `  {
    id: ${q(entry.id)},
    character: ${q(entry.character)},
    category: ${q(entry.category)},
    grade: ${entry.grade},
    strokeCount: ${entry.strokeCount},
    readings: { onyomi: [${onyomi}], kunyomi: [${kunyomi}] },
    meaning: ${q(entry.meaning)},
    examples: [
${examples}
    ],
    strokes: [
${strokes}
    ],
  },`;
}

function formatCategoryEntry(cat) {
  return `  {
    id: ${q(cat.id)},
    name: ${q(cat.name)},
    emoji: ${q(cat.emoji)},
    description: ${q(cat.description)},
    gradient: ${q(cat.gradient)},
  },`;
}

function writeIntoDataJs(newCategories, newEntries) {
  let src = fs.readFileSync(DATA_JS_PATH, 'utf8');

  if (newCategories.length > 0) {
    const anchor = '];\n\n// 小学2年生の漢字全160字の包括的学習データベース';
    if (!src.includes(anchor)) {
      throw new Error('Could not find the KANJI_CATEGORIES closing anchor in public/js/data.js -- file structure may have changed, edit manually instead.');
    }
    const block = newCategories.map(formatCategoryEntry).join('\n') + '\n';
    src = src.replace(anchor, block + anchor);
  }

  const dataAnchor = '];\n\n// 2年生の全160字リスト';
  if (!src.includes(dataAnchor)) {
    throw new Error('Could not find the KANJI_DATA closing anchor in public/js/data.js -- file structure may have changed, edit manually instead.');
  }
  const entryBlock = newEntries.map(formatKanjiEntry).join('\n') + '\n';
  src = src.replace(dataAnchor, entryBlock + dataAnchor);

  fs.writeFileSync(DATA_JS_PATH, src);
}

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const write = args.includes('--write');
  const force = args.includes('--force');
  if (inputIdx < 0 || !args[inputIdx + 1]) {
    console.error('Usage: node tools/kanji-data/add-kanji.mjs --input new-kanji.json [--write] [--force]');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(args[inputIdx + 1], 'utf8'));
  const newCategories = input.newCategories ?? [];
  const kanjiInput = input.kanji ?? [];

  if (kanjiInput.length === 0) {
    console.error('Input file has no "kanji" entries.');
    process.exit(1);
  }

  const existingCharacters = new Set(KANJI_DATA.map((k) => k.character));
  const existingIds = new Set(KANJI_DATA.map((k) => k.id));
  const categoryIds = new Set([...KANJI_CATEGORIES.map((c) => c.id), ...newCategories.map((c) => c.id)]);

  const seenCharacters = new Set();
  let hasBlockingProblems = false;
  const toGenerate = [];

  for (const entry of kanjiInput) {
    const { problems, warnings } = validateEntry(entry, existingCharacters, categoryIds, seenCharacters);
    seenCharacters.add(entry.character);

    console.log(`\n${entry.character || '?'}:`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
    for (const p of problems) console.log(`  ✗ ${p}`);

    const blocking = problems.filter((p) => !(force && p.startsWith(`${entry.character} is already in public/js/data.js`)));
    if (blocking.length > 0) {
      hasBlockingProblems = true;
      continue;
    }
    console.log('  ✓ passed validation');
    toGenerate.push(entry);
  }

  if (toGenerate.length === 0) {
    console.log('\nNo kanji passed validation -- nothing to generate.');
    process.exit(hasBlockingProblems ? 1 : 0);
  }

  console.log(`\nFetching KanjiVG stroke data for ${toGenerate.length} kanji...`);
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');

  const finalEntries = [];
  for (const entry of toGenerate) {
    try {
      const { codepoint, strokeCount, strokes } = await processCharacter(page, entry.character);
      finalEntries.push({
        id: entry.id || `k${codepoint}`,
        character: entry.character,
        category: entry.category,
        grade: entry.grade ?? 2,
        strokeCount,
        readings: { onyomi: entry.readings.onyomi ?? [], kunyomi: entry.readings.kunyomi ?? [] },
        meaning: entry.meaning,
        examples: entry.examples,
        strokes,
      });
      console.log(`  ✓ ${entry.character}: ${strokeCount} strokes`);
    } catch (err) {
      console.error(`  ✗ ${entry.character}: ${err.message}`);
      hasBlockingProblems = true;
    }
  }
  await browser.close();

  // IDs must also be unique against the rest of data.js and each other.
  const idCounts = {};
  for (const e of finalEntries) idCounts[e.id] = (idCounts[e.id] || 0) + 1;
  for (const e of finalEntries) {
    if (existingIds.has(e.id) || idCounts[e.id] > 1) {
      console.error(`\n✗ id ${JSON.stringify(e.id)} for ${e.character} collides with an existing/other new entry -- set an explicit "id" in the input file.`);
      hasBlockingProblems = true;
    }
  }
  if (hasBlockingProblems) {
    console.error('\nAborting: some entries failed. Fix the input and re-run.');
    process.exit(1);
  }

  if (write) {
    writeIntoDataJs(newCategories, finalEntries);
    console.log(`\nWrote ${finalEntries.length} kanji${newCategories.length ? ` and ${newCategories.length} new categor${newCategories.length === 1 ? 'y' : 'ies'}` : ''} into public/js/data.js.`);
    console.log('Run `npm test` to verify before committing.');
  } else {
    console.log('\n--- Dry run: review below, then re-run with --write to merge into public/js/data.js ---\n');
    if (newCategories.length > 0) {
      console.log('// Add to KANJI_CATEGORIES:');
      console.log(newCategories.map(formatCategoryEntry).join('\n'));
      console.log();
    }
    console.log('// Add to KANJI_DATA:');
    console.log(finalEntries.map(formatKanjiEntry).join('\n'));
  }
}

main();
