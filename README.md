# opcg-sim-frontend

ワンピースカードゲーム シミュレータのフロントエンド（React + Vite + Pixi.js）。
バックエンド `opcg-sim-backend` のルールエンジンと REST / WebSocket で通信し、対局盤面・デッキ作成・
カード閲覧を提供する。

## ドキュメント

文書の索引は [`docs/README.md`](docs/README.md)。

- [`docs/SPEC.md`](docs/SPEC.md) — システム仕様（画面・モード・オンライン/CPU 対戦・API クライアント）
- [`docs/screen-design.md`](docs/screen-design.md) — 画面設計書（各画面の目的・遷移・レイアウト・UI 要素・状態）
- [`docs/user-feature-classification.md`](docs/user-feature-classification.md) — ユーザ目線の機能分類

## 開発

```bash
npm ci
npx tsc -b      # 型チェック
npx eslint .    # lint
npx vite build  # 本番ビルド
```
