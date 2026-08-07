# かん字マスター 小2

小学2年生向けの、漢字の書き順を練習できるWebアプリです。ビルド不要のプレーンHTML/CSS/JSで作られており、[Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/) でホスティングしています。

## 特徴

- **本物の書き順データ**: 各漢字の画数・書き順は [KanjiVG](https://github.com/KanjiVG/kanjivg)（CC BY-SA 3.0）のデータを検証・変換して使用しています。曲がり・はねの形までチェックするので、直線でごまかして書いても正解になりません。
- **答えを隠す設計**: 「きょうのかん字」一覧や例文では、練習中の漢字そのものは表示されず読み方(ひらがな)で示されます。
- **2つの練習モード**: なぞり書き(銀)／チャレンジ(金)を切り替え可能。間違えると自動でなぞり書きに切り替わり、練習のハードルを下げます。
- **テストモード**: お手本・ヒントを一切出さない本番想定モード。誤操作で抜けないよう解除には2秒長押しが必要で、ブラウザの戻るボタンでの離脱もブロックします。
- **ペンモード**: iPadなどのタッチペン(Apple Pencil等)入力のみを受け付け、書いている最中に手のひらが触れて誤反応するのを防ぎます。
- **プリントから作ったテーマ**: 実際の宿題・テストのプリント写真から抽出した漢字テーマも収録しています（[docs/adding-a-kanji-theme.md](docs/adding-a-kanji-theme.md) 参照）。
- **プライバシー配慮**: アカウント登録・広告・外部トラッキング一切なし。学習の進み具合(金銀メダル)は保存せず、リロードするたびにまっさらな状態から始まります。

現在、**118字**の漢字を **12テーマ**に分けて収録しています。

## ローカルで動かす

ビルド不要なので、静的ファイルを配信するだけで動きます。

```sh
npm install
npm run dev
```

`http://localhost:3000` で開けます。

## テスト

[Playwright](https://playwright.dev/) を使ったブラウザテストを用意しています(`tests/`)。プルリクエストを出すと GitHub Actions で自動実行されます([.github/workflows/test.yml](.github/workflows/test.yml))。

```sh
npm install
npx playwright install --with-deps chromium
npm test
```

## デプロイ

Cloudflare Workers(Static Assets)へのGit連携デプロイを想定しています。ダッシュボード側で必要な一度きりの設定手順は [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) にまとめています。

## 新しいテーマを追加する

宿題やテストのプリント写真から新しいテーマを作る手順は [docs/adding-a-kanji-theme.md](docs/adding-a-kanji-theme.md) を参照してください。

## ライセンス

このプロジェクト自体のコードは [MIT License](LICENSE) です。

`js/data.js` 内の書き順データ(各画の始点・終点・パス)は [KanjiVG](https://github.com/KanjiVG/kanjivg)（Copyright (C) 2009-2011 Ulrich Apel、[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)）を参考に作成・検証しています。このデータを再利用・改変する場合は、KanjiVGのクレジット表記と同ライセンスでの公開が必要です。詳細は [LICENSE](LICENSE) を参照してください。
