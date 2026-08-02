# 星雲の庭

時刻と季節で表情を変える、Three.js製のインタラクティブWebアートだよ。

## セットアップと実行

```bash
npm install
npm run dev
```

`http://localhost:5173` を開く。静的公開用の成果物は `npm run build` で `dist/` に生成され、`npm run preview` で確認できる。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run typecheck` | TypeScript型検査 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest単体テスト |
| `npm run test:e2e` | ChromiumのE2E・16テーマ・レスポンシブ検証 |
| `npm run test:e2e:mobile` | iPhone/WebKit・Pixel/Chromiumのモバイル検証 |
| `npm run test:e2e:cross-browser` | Chromium / Firefox / WebKitの主要操作スモーク |
| `npm run test:network` | production previewをSlow 4G相当で5回測定 |
| `npm run test:soak` | production previewを3分間操作しメモリ・FPSを測定 |
| `npm run build` | production build |

## 操作

- ポインターを近づける: 星が引き寄せられる
- 素早く動かす: 光の軌跡が残る
- 長押しして離す: 小さな銀河が生まれる
- `F`: 全画面切り替え
- 音・共有・PNG保存: 右下のボタン

## テーマ確認

開発・テスト時だけ `debugDate` で時刻を固定できる。粒子配置も固定シードなので、テーマ比較を再現できる。

```text
/?debugDate=2026-04-01T06:00:00
```

時刻帯は朝（06:00）、昼（12:00）、夕方（18:00）、深夜（23:00）、季節は1月・4月・7月・10月を代表値に使う。

## 品質とフォールバック

端末のコア数・メモリ・DPR・描画サイズから品質を選び、低FPSが続くと段階的に軽量化する。`prefers-reduced-motion` では動きを抑え、WebGLが使えない／コンテキストを失った場合も日時・季節色の静止した星空を表示する。タブ非表示中は描画と音を止める。

## 公開

`dist/` は任意の静的ホスティング（GitHub Pages、Netlify、Cloudflare Pagesなど）へそのまま配置できる。サイトをサブパスで配る場合は、公開先のパスに合わせて `vite.config.ts` の `base` を設定してから build する。

### GitHub Pages

`.github/workflows/deploy.yml` は `main` へのpush（またはActions画面からの手動実行）で、`dist/` をGitHub Pagesへ公開する。リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を一度選ぶ。

- 通常のプロジェクトリポジトリ `OWNER/cosmic-garden` は、自動的に `https://OWNER.github.io/cosmic-garden/` 向けの `base: '/cosmic-garden/'` でbuildされる。
- `OWNER/OWNER.github.io` というユーザーサイトは、ルートURL向けの `base: '/'` でbuildされる。
- 独自の公開パスを使う場合は、GitHubの **Settings → Secrets and variables → Actions → Variables** に `PAGES_BASE_PATH` を追加する。`preview/cosmic-garden`、`/preview/cosmic-garden/` のどちらでも使え、`/preview/cosmic-garden/` に正規化される。

push前にはローカルでも `npm run build` を実行して確認する。ワークフロー成功後の公開URLは、Actions実行結果の **Deploy to GitHub Pages** ステップとSettings → Pagesで確認できる。

## QA成果物

Playwright自身の一時出力はスイート別に `test-results/e2e`、`test-results/mobile`、`test-results/cross-browser`、`test-results/soak` へ分離され、各スイート実行時に掃除される。

リリース判定に使う永続証跡は次の安定パスへ保存され、後続のPlaywright実行では削除されない。

- モバイルportrait／landscape画像4枚: [`release-artifacts/mobile/`](release-artifacts/mobile/)
- Slow 4G計測JSON／Markdown: [`release-artifacts/network/`](release-artifacts/network/)
- 3分soak計測JSON／Markdown／PNG: [`release-artifacts/soak/`](release-artifacts/soak/)

CDP低速回線検証はlocalhost向けの再現条件であり、実CDN、公開TLS/DNS、無線品質、基地局混雑は含まない。公開環境・実端末でも最終確認すること。
