import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer, type CardRenderOptions } from './CardRenderer';
import type { PlayerState, CardInstance, BoardCard, VirtualZoneCard } from '../game/types';
import { normalizeCardType } from '../game/cardTypes';

// 可動実カード（field/leader/stage/life/hand）の記述子。Phase4 の reconcile で
// uuid 同一のコンテナを使い回すために、解決済みカード・サイズ・サイドローカル座標を持つ。
export interface MovableDescriptor {
  uuid: string;
  card: VirtualZoneCard; // 解決済み（life の is_rest 上書き／hideHand の裏面化を含む）
  cw: number;
  ch: number;
  opts: CardRenderOptions;
  x: number; // サイドローカル
  y: number; // サイドローカル
  interactive: boolean; // 裏向きライフ等は false
}

// 盤面アイテムを生成順（z 順）どおりに列挙する単一ソース。
// virtual = 固定パイル・バッジ・空プレースホルダ（破棄→再構築でよい）。
// movable = 可動実カード（reconcile 対象）。
export type BoardItem =
  | { kind: 'virtual'; display: PIXI.Container }
  | { kind: 'movable'; desc: MovableDescriptor };

export const buildBoardItems = (
  p: PlayerState,
  isOpponent: boolean,
  W: number,
  coords: LayoutCoords,
  onCardClick: (card: CardInstance, pos: { x: number; y: number }) => void,
  selectableUuids?: Set<string>,
  selectedUuids?: Set<string>,
  hideHand: boolean = false,
  // 指定時、各カードにドラッグ開始ハンドラを配線する（自陣側のみ渡す想定）。
  onCardDragStart?: (card: CardInstance, pos: { x: number; y: number }) => void,
): BoardItem[] => {
  const items: BoardItem[] = [];
  const z = p.zones;

  const SMALL_SCALE = 0.7;
  const smallCW = coords.CW * SMALL_SCALE;
  const smallCH = coords.CH * SMALL_SCALE;

  const getX = (baseX: number) => isOpponent ? W - baseX : baseX;

  const getAdjustedY = (row: number) => {
    const offset = coords.getY(row);
    if (!isOpponent) {
      return offset + coords.CH / 2;
    } else {
      return coords.midY - offset - coords.CH / 2;
    }
  };

  const getCardOpts = (c: VirtualZoneCard): CardRenderOptions => ({
    onClick: (pos: { x: number; y: number }) => onCardClick(c as CardInstance, pos),
    onDragStart: onCardDragStart
      ? (pos: { x: number; y: number }) => onCardDragStart(c as CardInstance, pos)
      : undefined,
    isOpponent: isOpponent,
    isSelectable: selectableUuids?.has(c.uuid || '') ?? false,
    isSelected: selectedUuids?.has(c.uuid || '') ?? false,
  });

  // virtual 表示をその場で生成して push するヘルパー。
  const pushVirtual = (card: VirtualZoneCard, cw: number, ch: number, opts: CardRenderOptions, x: number, y: number) => {
    const display = createCardContainer(card, cw, ch, opts);
    display.x = x;
    display.y = y;
    items.push({ kind: 'virtual', display });
  };

  let stageCard = p.stage;
  const fieldCards = [...(z.field || [])];

  if (!stageCard) {
    const sIdx = fieldCards.findIndex(c => normalizeCardType(c.type) === 'STAGE');
    if (sIdx >= 0) {
      stageCard = fieldCards[sIdx];
      fieldCards.splice(sIdx, 1);
    }
  }

  // Row 1: フィールド
  fieldCards.forEach((c: BoardCard, i: number) => {
    items.push({
      kind: 'movable',
      desc: {
        uuid: c.uuid,
        card: c,
        cw: coords.CW,
        ch: coords.CH,
        opts: getCardOpts(c),
        x: getX(coords.getFieldX(i, W, coords.CW, fieldCards.length)),
        y: getAdjustedY(1),
        interactive: true,
      },
    });
  });

  const r2Y = getAdjustedY(2);
  const r3Y = getAdjustedY(3);
  const r4Y = getAdjustedY(4);

  // リーダー
  if (p.leader) {
    items.push({
      kind: 'movable',
      desc: {
        uuid: p.leader.uuid,
        card: p.leader,
        cw: coords.CW,
        ch: coords.CH,
        opts: getCardOpts(p.leader),
        x: getX(coords.getLeaderX(W)),
        y: r2Y,
        interactive: true,
      },
    });
  }

  // ステージ
  if (stageCard) {
    items.push({
      kind: 'movable',
      desc: {
        uuid: stageCard.uuid,
        card: stageCard,
        cw: coords.CW,
        ch: coords.CH,
        opts: getCardOpts(stageCard),
        x: getX(coords.getStageX(W)),
        y: r2Y,
        interactive: true,
      },
    });
  }

  // ライフ
  const lifeCards = z.life || [];
  const lifeX = getX(coords.getLifeX(W));

  if (lifeCards.length === 0) {
    const emptyLife = { uuid: `life-${p.player_id}`, name: 'Life' } as VirtualZoneCard;
    pushVirtual(emptyLife, coords.CW, coords.CH, { ...getCardOpts(emptyLife), count: 0 }, lifeX, r2Y);
  } else {
    const lifeScale = 0.85;
    const lcw = coords.CW * lifeScale;
    const lch = coords.CH * lifeScale;
    const n = lifeCards.length;
    const step = n > 1 ? Math.min(lcw * 0.5, (coords.CH - lcw) / (n - 1)) : 0;
    const stackH = lcw + step * (n - 1);

    for (let i = n - 1; i >= 0; i--) {
      const c = lifeCards[i];
      const isFaceUp = c.is_face_up === true;
      const renderCard = { ...c, is_rest: true } as CardInstance;
      items.push({
        kind: 'movable',
        desc: {
          uuid: c.uuid,
          card: renderCard,
          cw: lcw,
          ch: lch,
          opts: getCardOpts(c),
          x: lifeX,
          y: r2Y - stackH / 2 + lcw / 2 + i * step,
          interactive: isFaceUp,
        },
      });
    }

    // ライフ枚数バッジ（uuid 無し→ virtual）。
    const badgeR = lcw * 0.26;
    const edgeSign = isOpponent ? 1 : -1;
    const badgeX = lifeX + edgeSign * (lch / 2 + badgeR + 3);
    const badgeWrap = new PIXI.Container();
    const badge = new PIXI.Graphics()
      .beginFill(0x000000, 0.85)
      .lineStyle(1, 0xffffff)
      .drawCircle(badgeX, r2Y, badgeR)
      .endFill();
    badgeWrap.addChild(badge);
    const badgeText = new PIXI.Text(`${n}`, {
      fontSize: badgeR * 1.2,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    badgeText.anchor.set(0.5);
    badgeText.position.set(badgeX, r2Y);
    badgeWrap.addChild(badgeText);
    items.push({ kind: 'virtual', display: badgeWrap });
  }

  // デッキ
  const deckCard = { uuid: `deck-${p.player_id}`, name: 'Deck' } as VirtualZoneCard;
  pushVirtual(deckCard, coords.CW, coords.CH, getCardOpts(deckCard), getX(coords.getDeckX(W)), r2Y);

  // トラッシュ
  const trashCount = z.trash?.length || 0;
  const topTrashCard = z.trash && z.trash.length > 0 ? z.trash[z.trash.length - 1] : null;
  const trashCard = {
    uuid: `trash-${p.player_id}`,
    name: 'Trash',
    cards: z.trash,
    card_id: topTrashCard ? topTrashCard.card_id : undefined,
  } as VirtualZoneCard;
  pushVirtual(
    trashCard,
    smallCW,
    smallCH,
    { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash', cards: z.trash } as VirtualZoneCard), count: trashCount },
    getX(coords.getTrashX(W)),
    r3Y,
  );

  // ドン!!デッキ
  const donDeckCount = p.don_deck_count ?? 0;
  const donDeckCard = { uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as VirtualZoneCard;
  pushVirtual(donDeckCard, smallCW, smallCH, { ...getCardOpts(donDeckCard), count: donDeckCount }, getX(coords.getDonDeckX(W)), r3Y);

  // アクティブドン
  const donActiveCount = (p.don_active || []).length;
  const donActiveCard = { uuid: `donactive-${p.player_id}`, name: 'Don!! Active', card_id: 'DON' } as VirtualZoneCard;
  pushVirtual(
    donActiveCard,
    smallCW,
    smallCH,
    { ...getCardOpts({ uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as VirtualZoneCard), count: donActiveCount },
    getX(coords.getDonActiveX(W)),
    r3Y,
  );

  // レストドン
  const donRestCount = (p.don_rested || []).length;
  const donRestCard = { uuid: `donrest-${p.player_id}`, name: 'Don!! Rest', is_rest: true, card_id: 'DON' } as VirtualZoneCard;
  pushVirtual(
    donRestCard,
    smallCW,
    smallCH,
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as VirtualZoneCard), count: donRestCount },
    getX(coords.getDonRestX(W)),
    r3Y,
  );

  // 手札
  const handList = z.hand || [];
  const maxHandWidth = W * 0.9;
  const cardWidth = coords.CW;
  const totalWidthNeeded = handList.length * cardWidth + (handList.length - 1) * 10;

  let stepX = cardWidth + 10;
  let startX = coords.getHandX(0, W);

  if (totalWidthNeeded > maxHandWidth && handList.length > 1) {
    stepX = (maxHandWidth - cardWidth) / (handList.length - 1);
    startX = (W - maxHandWidth) / 2 + cardWidth / 2;
  } else if (handList.length > 0) {
    const contentWidth = (handList.length - 1) * stepX;
    startX = W / 2 - contentWidth / 2;
  }

  handList.forEach((c: CardInstance, i: number) => {
    // オンライン対戦の相手手札は中身を伏せる（is_face_up=false で裏面描画 + 識別情報を空に）。
    const renderCard: CardInstance = hideHand ? { ...c, is_face_up: false, card_id: '', name: 'Card' } : c;
    items.push({
      kind: 'movable',
      desc: {
        uuid: c.uuid,
        card: renderCard,
        cw: coords.CW,
        ch: coords.CH,
        opts: getCardOpts(renderCard),
        x: getX(startX + i * stepX),
        y: r4Y,
        interactive: true,
      },
    });
  });

  return items;
};

// 1サイド分の表示コンテナを生成（従来挙動。reconcile OFF 経路で使用）。
// buildBoardItems を単一ソースに、生成順（z 順）どおり全アイテムを1コンテナへ積む。
export const createBoardSide = (
  p: PlayerState,
  isOpponent: boolean,
  W: number,
  coords: LayoutCoords,
  onCardClick: (card: CardInstance, pos: { x: number; y: number }) => void,
  selectableUuids?: Set<string>,
  selectedUuids?: Set<string>,
  hideHand: boolean = false,
  onCardDragStart?: (card: CardInstance, pos: { x: number; y: number }) => void,
) => {
  const side = new PIXI.Container();
  const items = buildBoardItems(p, isOpponent, W, coords, onCardClick, selectableUuids, selectedUuids, hideHand, onCardDragStart);
  for (const item of items) {
    if (item.kind === 'virtual') {
      side.addChild(item.display);
    } else {
      const d = item.desc;
      const card = createCardContainer(d.card, d.cw, d.ch, d.opts);
      card.x = d.x;
      card.y = d.y;
      if (!d.interactive) {
        card.eventMode = 'none';
        card.cursor = 'default';
      }
      side.addChild(card);
    }
  }
  return side;
};
