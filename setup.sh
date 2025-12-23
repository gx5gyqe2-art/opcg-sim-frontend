#!/usr/bin/env bash
set -euo pipefail

# ルートで実行される想定
ROOT="$(pwd)"
TMP=".vite_tmp"

echo "[1/6] Check existing project..."
if [ -f package.json ]; then
  echo "package.json already exists. Skip Vite scaffold."
else
  echo "[2/6] Scaffold Vite project into temp dir (non-interactive)..."
  rm -rf "$TMP"
  mkdir "$TMP"
  cd "$TMP"

  # ここは「空ディレクトリ」なので、create-vite が止まらない
  npm create vite@latest . -- --template react-ts --yes

  # node_modules は不要（重いので移動しない）
  rm -rf node_modules

  echo "[3/6] Move scaffold files to repo root..."
  cd "$ROOT"

  # 既存ファイルと衝突する可能性が高いものはリネームして残す（後で手でマージ可）
  if [ -f "$TMP/README.md" ] && [ -f "README.md" ]; then
    mv "$TMP/README.md" "README.vite.md"
  fi
  if [ -f "$TMP/.gitignore" ] && [ -f ".gitignore" ]; then
    mv "$TMP/.gitignore" ".gitignore.vite"
  fi

  # dotfile含めて移動（bash前提）
  bash -lc "shopt -s dotglob nullglob; for f in '$TMP'/*; do mv -n \"\$f\" .; done"

  rm -rf "$TMP"
fi

echo "[4/6] Install dependencies..."
npm install

echo "[5/6] Add libraries..."
npm install pixi.js
npm install -D vite-plugin-pwa

echo "[6/6] Build check..."
npm run build

echo "DONE."