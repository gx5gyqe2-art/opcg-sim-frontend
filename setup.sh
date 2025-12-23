#!/usr/bin/env bash
set -e

# Vite + React(TS) をカレントディレクトリに作成
# 既にREADME等があるので対話が出る → "Ignore files and continue" を自動選択して続行
# （Down, Down, Enter） ※選択肢の順番が変わると失敗します
printf '\e[B\e[B\r' | npm create vite@latest . -- --template react-ts --yes

# 依存インストール
npm install

# Pixi（描画）
npm install pixi.js

# PWA（後で設定するためのプラグイン）
npm install -D vite-plugin-pwa

# ビルド確認
npm run build