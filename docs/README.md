# ドキュメント索引

`opcg-sim-frontend` のドキュメントは、**文書の種別（ライフサイクル）** で分類する。

> 計画書（plan）は実装完了後に正本（SPEC）へ吸収し、文書としては残さない。
> 設計の経緯は git 履歴を参照する。

## 仕様（正本）

| 文書 | 内容 |
|---|---|
| [`SPEC.md`](SPEC.md) | **システム仕様書**（React + Vite + Pixi.js）。画面モード／ルールモード（ソロ・オンライン対戦・**CPU 対戦**）／フリーモード・ロビー／API クライアント・状態同期／ファイルマップ／検証手順 |
| [`screen-design.md`](screen-design.md) | **画面設計書**。各画面（`AppMode`）の目的・遷移・レイアウト・UI 要素・状態（条件分岐）を画面単位で記述。共通モーダル／オーバーレイも収録 |
| [`user-feature-classification.md`](user-feature-classification.md) | **ユーザ目線の機能分類**。メニュー階層（PLAY → モード → プレイ／Deck & Cards）に沿った全機能の整理 |

## 関連（バックエンド）

- システム仕様: `opcg-sim-backend/docs/SPEC.md`（コアルール・オンライン対戦・効果システム）
- テスト仕様: `opcg-sim-backend/docs/TEST_SPEC.md`
- 文書索引: `opcg-sim-backend/docs/README.md`

## 開発

```bash
npm ci
npx tsc -b      # 型チェック
npx eslint .    # lint
npx vite build  # 本番ビルド
```
