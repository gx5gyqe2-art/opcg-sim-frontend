set -e

# Vite + React(TS) をカレントディレクトリに作成（対話を避ける）
npm create vite@latest . -- --template react-ts --yes

# 依存インストール
npm install

# Pixi（描画）
npm install pixi.js

# PWA（後で設定するためのプラグイン）
npm install -D vite-plugin-pwa

# ビルド確認
npm run build