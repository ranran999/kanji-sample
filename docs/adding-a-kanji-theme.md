# 新しい漢字・テーマを追加する

新しい漢字を追加する方法は2つあります。

- **写真から追加する**: 宿題やテストのプリントの写真から、どの漢字を練習させたいかをAIチャットで読み取って追加する方法。既存のテーマ(`aprilmay`・`g1review`・`matome2`・`matome3` など)はこの方法で作られました。→ [1. 写真から追加する](#1-写真から追加する)
- **直接追加する**: 追加したい漢字・カテゴリ・例文がすでに分かっている場合に、`tools/kanji-data/add-kanji.mjs` で直接追加する方法。写真もAIチャットも不要です。→ [2. 直接追加する（add-kanji.mjs）](#2-直接追加するadd-kanjimjs)

どちらの方法でも、書き順データ(画数・各画の始点/終点・SVGパス)はKanjiVGから自動生成され、`js/data.js` に手で読み方・意味・例文を書く/確認する部分は共通です。

## 1. 写真から追加する

大きく3つの工程に分かれます。

1. 写真から対象の漢字を読み取る(**AIチャットへの依頼**。スクリプトでは自動化できません)
2. KanjiVGから書き順データを生成する(`tools/kanji-data/` の**スクリプトで自動化**)
3. 読み方・意味・例文を作り、`js/data.js` に手作業でマージする

### 1.1 写真から対象の漢字を読み取る

プリントの写真からどの漢字を練習させたいかを読み取る作業は、単純なOCRでは行や振り仮名の位置関係を誤認しやすく、実用的に自動化できません。Claude などの画像を読めるAIチャットに写真を渡し、次のようなプロンプトで依頼してください。

> この画像は小学校のプリントです。このプリントで練習させたい漢字を、書かれている順番どおりにすべて教えてください。
>
> - 漢字1文字ずつ、読み方(音読み・訓読み)も分かれば添えてください
> - すでに別の漢字テーマに含まれている漢字か、プリントの中身から重複しているものがあれば教えてください
> - 何年生向けの漢字か分かれば教えてください

出てきた漢字リストを、既存の `js/data.js` の `KANJI_DATA` と突き合わせて「すでに収録済みの漢字」と「新規に追加が必要な漢字」に仕分けます。

```sh
node -e "
import('./js/data.js').then(({ KANJI_DATA }) => {
  const existing = new Set(KANJI_DATA.map((k) => k.character));
  console.log(existing.has('火')); // 既存なら true
});
"
```

### 1.2 KanjiVGから書き順データを生成する

新規に追加する漢字が決まったら、`tools/kanji-data/generate-stroke-data.mjs` で書き順データ(画数・各画の始点/終点・SVGパス・ヒント文)を自動生成します。[KanjiVG](https://github.com/KanjiVG/kanjivg)(CC BY-SA 3.0)のデータを取得し、このアプリの `0-100` 座標系に変換します。

事前準備(初回のみ):

```sh
npm install
npx playwright install --with-deps chromium
```

実行:

```sh
node tools/kanji-data/generate-stroke-data.mjs 火 水 木 --out /tmp/new-strokes.json
```

- ネットワークアクセスが必要です(`raw.githubusercontent.com` からSVGを取得します)。
- 変換の誤差が大きい画があれば `! <漢字>: N stroke(s) exceeded 1.5 rescale tolerance` という警告が出ます。警告が出た漢字は、生成された `svgPath` を見直すか手作業で調整してください。
- 出力されたJSONの `strokes` 配列は、`js/data.js` の各漢字エントリの `strokes:` にそのまま貼り付けられる形になっています。

### 1.3 読み方・意味・例文を作り、data.js にマージする

`tools/kanji-data/generate-stroke-data.mjs` が作るのは書き順(形)のデータだけです。読み方・意味・例文は手作業で書き、`js/data.js` の `KANJI_DATA` 配列に新しいオブジェクトとして追加してください。新しいテーマであれば `KANJI_CATEGORIES` にもカテゴリを追加します。

このアプリは「きょうのかん字」一覧や例文で、練習中の漢字そのものを隠して読み方(ひらがな)に置き換える表示をします(`js/kanjiText.js` の `maskAnswerInText`/`maskAnswerInHtml`)。例文を書くときは、この置き換えが自然な文になるよう次の点に注意してください(この注意点は[2章の `add-kanji.mjs`](#2-直接追加するadd-kanjimjs)を使う場合にも共通です)。

- **`examples[0]` だけが画面に表示されます**(`kanjiInfoCard.js`)。`examples[1]` は表示されないので、置き換えの正しさより単語としての参考情報を優先して構いません。
- `examples[0].sentence` には対象の漢字を必ず1文字そのまま含めてください(ひらがなだけの文にしない)。
- `onyomi`/`kunyomi` は配列の**先頭の要素が置き換えに使われます**。例文の読み方が音読みか訓読みかに応じて、使いたい読みを配列の先頭に置いてください(例: 「絵」で「え」を使わせたいなら `onyomi: ['エ', 'カイ']` の順にする)。
- 熟語を例文に使う場合、連濁(例: 「小刀」= こ**が**たな)や促音便など、対象の漢字1文字の読みだけでは表せない音の変化が起きる単語は避けてください。置き換えた結果が不自然な読みになります。
- 送り仮名がある訓読み(例: 「き（る）」)は、実際にその送り仮名込みで使う場合のみ丸括弧表記にしてください。送り仮名を伴わない名詞的な使い方(例: 「気」を「き」とだけ読む場合)に丸括弧表記を流用しないでください。

書き終えたら、以下を実行して確認します。

```sh
npm test
```

`tests/masking-audit.test.mjs` が新しい漢字も含めて読み方の置き換えを自動チェックします。`tests/shape-check.test.mjs` は生成した書き順データの形状(始点・終点・パス)が壊れていないかを確認します。

## 2. 直接追加する（add-kanji.mjs）

追加したい漢字・カテゴリ・読み方・例文がすでに分かっている場合(写真からの読み取りが不要な場合)は、`tools/kanji-data/add-kanji.mjs` で直接追加できます。内部では1章と同じKanjiVGパイプラインを使って書き順データを自動生成しつつ、**マージする前に**上記1.3の注意点(読みの順序・例文に漢字が含まれているか等)を自動チェックします。

事前準備は1.2と同じです(`npm install && npx playwright install --with-deps chromium`)。

入力用のJSONファイルを作ります(例: `new-kanji.json`)。

```json
{
  "newCategories": [
    { "id": "lake", "name": "みずうみの かん字", "emoji": "🏞️", "description": "...",
      "gradient": "linear-gradient(135deg, #38bdf8, #0ea5e9)" }
  ],
  "kanji": [
    {
      "character": "湖",
      "id": "mizuumi",
      "category": "lake",
      "grade": 2,
      "readings": { "onyomi": ["コ"], "kunyomi": ["みずうみ"] },
      "meaning": "みずうみ",
      "examples": [
        { "word": "湖（みずうみ）", "reading": "みずうみ", "sentence": "山の中に 湖が ある。" }
      ]
    }
  ]
}
```

- `newCategories` は新しいテーマを作る場合だけ指定します。既存のカテゴリに追加するだけなら省略できます。
- `id` は省略可能です(省略時は `k<コードポイント>` になります)。
- `category` は既存の `KANJI_CATEGORIES` の `id`、または同じ入力ファイル内の `newCategories` の `id` である必要があります。

まずドライラン(ファイルは変更されません)で確認します。

```sh
node tools/kanji-data/add-kanji.mjs --input new-kanji.json
```

- 既存の漢字と重複していないか、カテゴリが存在するか、読みが空でないか、`examples[0].sentence` に漢字本体が含まれているかをチェックします。
- `examples[0].word` が「漢字（よみ）」という単純な形の場合は、その よみ が `readings` から計算される表示用の読みと一致するかまで自動チェックします(1.3の「太い」バグや「本」バグと同じ種類の間違いを検出します)。熟語の場合はこの完全一致チェックができないため、警告のみ表示されます(連濁などは目視で確認してください)。
- 検証に通った漢字だけKanjiVGから書き順データを取得し、`js/data.js` にそのまま貼り付けられる形式で標準出力に表示します。

内容を確認したら `--write` を付けて実行すると、`js/data.js` に直接書き込まれます。

```sh
node tools/kanji-data/add-kanji.mjs --input new-kanji.json --write
npm test
```

既に存在する漢字を(意図的に)重複追加したい場合は `--force` を付けてください。
