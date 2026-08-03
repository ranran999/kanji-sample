# デプロイ設定メモ（Cloudflare Workers）

このアプリはビルド不要な静的HTML/CSS/JSで、Cloudflare Workers（Static
Assets機能）にGit連携でデプロイしている。リポジトリ側の設定
（`wrangler.toml` など）はコードで管理できるが、Cloudflareダッシュボード
側の設定はAPI/CLIから自動化できず、手動での一度きりの操作が必要だった。
このプロジェクトを作り直す場合や、他のリポジトリで同じ構成を再現する
場合のために、必要だった手作業をまとめておく。

## 1. リポジトリとCloudflareの連携

Cloudflareダッシュボード → **Workers & Pages** → **Create application**
→ **Import a repository**（「Connect to Git」）から、このリポジトリ
（`ranran999/kanji-sample`）を接続する。

- 初回接続時に `Error connecting to git account`
  （GitHub側へのCloudflare Pages Appのインストールに失敗するエラー）が
  発生した。GitHub側の **Settings → Applications → Installed GitHub
  Apps** から「Cloudflare Pages」を一度アンインストールし、
  ダッシュボードから再度「Connect to Git」をやり直すことで解決した。
- リポジトリに `wrangler.toml` があるため、Cloudflareは「Pages」では
  なく **Workers** プロジェクトとして作成する（`wrangler deploy` を
  使うビルドフローになる）。

## 2. Build設定（Settings → Builds）

**Build configuration**（鉛筆アイコンで編集）:

| 項目 | 値 |
|---|---|
| Build command | （空、ビルド不要なので不要） |
| Deploy command | `npx wrangler deploy` |
| Version command | `npx wrangler versions upload` |
| Root directory | `/` |

⚠️ **重要**: Deploy commandとVersion commandは必ず別コマンドにすること。
どちらも `npx wrangler deploy` のままだと、`main` 以外のブランチ
（PRブランチ）へのpushでも本番トラフィックが100%上書きされてしまい、
PRごとの独立したプレビューが作られない。`versions upload` にすることで、
本番を上書きしない専用バージョン（プレビューURL付き）が作られる。

**Branch control**:

| 項目 | 値 |
|---|---|
| Production branch | `main` |
| Builds for non-production branches | Enabled |

## 3. Preview URLs（Settings → Domains & Routes）

**Preview URLs** をEnableにする。有効にすると、プレビュー用のURLパターン
（`*-kanji-sample.<サブドメイン>.workers.dev`）が使えるようになる。

- ただし、CloudflareのBotがPRに付けるコメント（「Deploying with
  Cloudflare Workers」）には、ビルドログへのリンクしか載らず、実際の
  プレビューURLへの直接リンクは**含まれない**（2026年8月時点の挙動）。
  実際のプレビューURLを確認したいときは、Cloudflareダッシュボードの
  該当プロジェクトの **Deployments** タブ、または「View logs」の先の
  ビルド詳細ページから確認する必要がある。

## 4. `wrangler.toml` の `name`

`wrangler.toml` の `name` は、Cloudflare側で作成されたプロジェクト名
（このリポジトリでは `kanji-sample`）と一致させておくこと。ズレていると
Build設定画面に警告が出る（Wrangler v3.109.0+では自動でズレを直すPRが
作られるとのこと）。

## 5. GitHub Pagesは使っていない理由

最初はGitHub Pagesへのデプロイも検討したが、このリポジトリは
**private** で、GitHub PagesをprivateリポジトリからデプロイするのはGitHub
Free プランでは不可（GitHub Pro / Team / Enterprise が必要）。無料枠の
まま使うため、Cloudflare Workersでのデプロイに切り替えた。
