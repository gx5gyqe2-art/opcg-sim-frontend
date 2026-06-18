import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';

// ゲーム中盤面の背景を描画する単一ソース。
// 構成: ①ダークグラデ＋ビネット（canvas テクスチャ）②サイドごとの半透明プレイマット
// パネル＋キャラ行バンド（区画）③発光ディバイダ ④手番側ハーフのグロー。
// すべて Pixi 描画（画像アセット不要）。renderScene の bg/border 描画を置き換える。

export type ActiveSide = 'top' | 'bottom' | null;

// グラデ＋ビネットのテクスチャをサイズ単位でキャッシュ（renderScene 毎の再生成を避ける）。
// 盤面コンテナは destroy({children:true}) で破棄されるが Sprite の baseTexture は保持されるため、
// 同一サイズ間ではこのキャッシュを使い回す。リサイズ時のみ旧テクスチャを破棄して張り直す。
let cachedKey = '';
let cachedTexture: PIXI.Texture | null = null;

const buildBackdropTexture = (W: number, H: number): PIXI.Texture => {
  const key = `${W}x${H}`;
  if (cachedKey === key && cachedTexture) return cachedTexture;
  if (cachedTexture) cachedTexture.destroy(true);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const midY = H / 2;

  // 上半分（相手）: 赤寄りの暗色 → 中央へ向けてニュートラルダーク
  const gTop = ctx.createLinearGradient(0, 0, 0, midY);
  gTop.addColorStop(0, '#2a1418');
  gTop.addColorStop(1, '#14161e');
  ctx.fillStyle = gTop;
  ctx.fillRect(0, 0, W, midY);

  // 下半分（自陣）: 中央ニュートラルダーク → 青緑寄りの暗色
  const gBot = ctx.createLinearGradient(0, midY, 0, H);
  gBot.addColorStop(0, '#141b1e');
  gBot.addColorStop(1, '#0d1a18');
  ctx.fillStyle = gBot;
  ctx.fillRect(0, midY, W, H - midY);

  // ビネット（四隅を落として中央へ視線を集める）
  const vg = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.18,
    W / 2, H / 2, Math.max(W, H) * 0.72,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const tex = PIXI.Texture.from(canvas);
  cachedKey = key;
  cachedTexture = tex;
  return tex;
};

// サイド（top/bottom）ごとのプレイマットパネル＋キャラ行バンドを描画する。
const drawSidePanel = (
  g: PIXI.Graphics,
  isTop: boolean,
  W: number,
  coords: LayoutCoords,
) => {
  const midY = coords.midY;
  const insetX = Math.max(10, W * 0.015);
  const insetY = 8;

  // プレイマットパネル（ハーフ全体を角丸で囲む）
  const panelY = isTop ? insetY : midY + insetY;
  const panelH = midY - insetY * 2;
  g.lineStyle(1.5, 0xffffff, 0.10);
  g.beginFill(0xffffff, 0.025);
  g.drawRoundedRect(insetX, panelY, W - insetX * 2, panelH, 18);
  g.endFill();

  // キャラ行バンド（Row1 = 主戦場の区画を強調）
  const CH = coords.CH;
  const CW = coords.CW;
  const left = coords.getFieldX(0, W, CW, 5) - CW / 2;
  const right = coords.getFieldX(4, W, CW, 5) + CW / 2;
  const bandPad = CH * 0.12;
  const bandX = left - bandPad;
  const bandW = (right - left) + bandPad * 2;
  const rowYCenter = isTop
    ? midY - coords.getY(1) - CH / 2
    : midY + coords.getY(1) + CH / 2;
  const bandY = rowYCenter - CH / 2 - bandPad;
  const bandH = CH + bandPad * 2;
  g.lineStyle(1, 0xffffff, 0.07);
  g.beginFill(0xffffff, 0.03);
  g.drawRoundedRect(bandX, bandY, bandW, bandH, 12);
  g.endFill();
};

// 手番側ハーフのパネル外周にカラーグローを足す（自陣=ティール／相手=赤）。
const drawTurnGlow = (
  g: PIXI.Graphics,
  side: 'top' | 'bottom',
  W: number,
  coords: LayoutCoords,
) => {
  const midY = coords.midY;
  const insetX = Math.max(10, W * 0.015);
  const insetY = 8;
  const color = side === 'bottom' ? 0x34e0a6 : 0xe74c3c;
  const panelY = side === 'top' ? insetY : midY + insetY;
  const panelH = midY - insetY * 2;

  // 太く淡い外周 → 細く明るい内周で発光に見せる。
  g.lineStyle(6, color, 0.10);
  g.drawRoundedRect(insetX, panelY, W - insetX * 2, panelH, 18);
  g.lineStyle(2, color, 0.5);
  g.drawRoundedRect(insetX, panelY, W - insetX * 2, panelH, 18);
};

export const createBoardBackground = (
  W: number,
  H: number,
  coords: LayoutCoords,
  opts: { activeSide: ActiveSide } = { activeSide: null },
): PIXI.Container => {
  const container = new PIXI.Container();

  // ① グラデ＋ビネット
  const backdrop = new PIXI.Sprite(buildBackdropTexture(W, H));
  backdrop.width = W;
  backdrop.height = H;
  container.addChild(backdrop);

  // ② プレイマットパネル＋キャラ行バンド（上下）
  const panels = new PIXI.Graphics();
  drawSidePanel(panels, true, W, coords);
  drawSidePanel(panels, false, W, coords);
  container.addChild(panels);

  // ④ 手番グロー
  if (opts.activeSide) {
    const glow = new PIXI.Graphics();
    drawTurnGlow(glow, opts.activeSide, W, coords);
    container.addChild(glow);
  }

  // ③ 発光ディバイダ（中央の戦闘ライン）
  const divider = new PIXI.Graphics();
  const midY = coords.midY;
  divider.lineStyle(6, 0xffd54d, 0.06).moveTo(0, midY).lineTo(W, midY);
  divider.lineStyle(3, 0xffd54d, 0.14).moveTo(0, midY).lineTo(W, midY);
  divider.lineStyle(1, 0xffe9b0, 0.55).moveTo(0, midY).lineTo(W, midY);
  container.addChild(divider);

  return container;
};
