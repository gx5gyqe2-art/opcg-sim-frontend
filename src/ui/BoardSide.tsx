import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';
import type { PlayerState, CardInstance, BoardCard, VirtualZoneCard } from '../game/types';
import { normalizeCardType } from '../game/cardTypes';
import { logger } from '../utils/logger';
// 未使用のインポートを削除しました

export const createBoardSide = (
  p: PlayerState,
  isOpponent: boolean,
  W: number,
  coords: LayoutCoords,
  onCardClick: (card: CardInstance, pos: { x: number; y: number }) => void,
  selectableUuids?: Set<string>,
  selectedUuids?: Set<string>,
) => {
  const side = new PIXI.Container();
  const z = p.zones;
  // 未使用の COLORS 定義を削除しました
  
  // Sandbox仕様: サイズ縮小用の係数 (70%)
  const SMALL_SCALE = 0.7;
  const smallCW = coords.CW * SMALL_SCALE;
  const smallCH = coords.CH * SMALL_SCALE;

  // Sandbox仕様: X座標を反転させるヘルパー
  const getX = (baseX: number) => isOpponent ? W - baseX : baseX;

  const getAdjustedY = (row: number) => {
    const offset = coords.getY(row);
    if (!isOpponent) {
      return offset + coords.CH / 2;
    } else {
      return coords.midY - offset - coords.CH / 2;
    }
  };

  const getCardOpts = (c: VirtualZoneCard) => ({
    onClick: (pos: { x: number; y: number }) => onCardClick(c as CardInstance, pos),
    isOpponent: isOpponent,
    isSelectable: selectableUuids?.has(c.uuid || '') ?? false,
    isSelected: selectedUuids?.has(c.uuid || '') ?? false,
  });

  if (z.field && z.field.length > 0 && !isOpponent) {
     logger.log({
      level: 'info',
      action: 'ui.debug_field_cards',
      msg: `Field Check for ${p.player_id}`,
      payload: { 
        cards: z.field.map(c => ({ name: c.name, type: c.type, uuid: c.uuid }))
      }
    });
  }

  let stageCard = p.stage;
  const fieldCards = [...(z.field || [])]; 

  if (!stageCard) {
    const sIdx = fieldCards.findIndex(c => normalizeCardType(c.type) === 'STAGE');

    if (sIdx >= 0) {
      stageCard = fieldCards[sIdx];
      fieldCards.splice(sIdx, 1);
    }
  }

  // Row 1: フィールド (getX適用)
  fieldCards.forEach((c: BoardCard, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    card.x = getX(coords.getFieldX(i, W, coords.CW, fieldCards.length));
    card.y = getAdjustedY(1);
    side.addChild(card);
  });

  const r2Y = getAdjustedY(2);
  const r3Y = getAdjustedY(3);
  const r4Y = getAdjustedY(4);

  // リーダー (getX適用)
  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, getCardOpts(p.leader));
    ldr.x = getX(coords.getLeaderX(W)); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  // ステージ (getX適用)
  if (stageCard) {
    const stg = createCardContainer(stageCard, coords.CW, coords.CH, getCardOpts(stageCard));
    stg.x = getX(coords.getStageX(W));
    stg.y = r2Y; 
    side.addChild(stg);
  }

  // ライフ: 横向き(90°回転)のカードを少しずつ縦にずらして重ね、
  // 各カードの表/裏が判別できるように描画する（自分・相手の両側に適用）。
  const lifeCards = z.life || [];
  const lifeX = getX(coords.getLifeX(W));

  if (lifeCards.length === 0) {
    // 0枚は従来どおり EMPTY プレースホルダー（count:0 経路）を表示。
    const emptyLife = { uuid: `life-${p.player_id}`, name: 'Life' } as VirtualZoneCard;
    const life = createCardContainer(emptyLife, coords.CW, coords.CH, {
      ...getCardOpts(emptyLife),
      count: 0,
    });
    life.x = lifeX; life.y = r2Y;
    side.addChild(life);
  } else {
    const lifeScale = 0.85;                 // 6枚程度まで帯に収まるよう少し縮小
    const lcw = coords.CW * lifeScale;
    const lch = coords.CH * lifeScale;
    const n = lifeCards.length;
    // 横向きカードの縦方向の見かけ高さは lcw。重ね段差は枚数に応じて自動調整し、
    // スタック全体がカード1枚分(coords.CH)の帯に収まるようにする。
    const step = n > 1 ? Math.min(lcw * 0.5, (coords.CH - lcw) / (n - 1)) : 0;
    const stackH = lcw + step * (n - 1);

    // life[0] が山の一番上(ダメージで最初に取られる)。最前面かつ最上段に
    // 描画するため、z順が後勝ちになるよう逆順で addChild する。
    for (let i = n - 1; i >= 0; i--) {
      const c = lifeCards[i];
      const isFaceUp = c.is_face_up === true;
      // is_rest 経路の90°回転を流用して横向き描画。onClick には元カード c を渡す。
      const renderCard = { ...c, is_rest: true } as CardInstance;
      const lifeCard = createCardContainer(renderCard, lcw, lch, getCardOpts(c));
      lifeCard.x = lifeX;
      lifeCard.y = r2Y - stackH / 2 + lcw / 2 + i * step;
      if (!isFaceUp) {
        // 裏向きライフは内容を確認できないためタップ無効。
        lifeCard.eventMode = 'none';
        lifeCard.cursor = 'default';
      }
      side.addChild(lifeCard);
    }

    // ライフ枚数バッジ(重なりで枚数が読み取りづらい場合の補助)。
    // 盤面端側(中央のリーダーと逆方向)に小さく表示する。
    const badgeR = lcw * 0.26;
    const edgeSign = isOpponent ? 1 : -1; // 自陣ライフは左寄せ→左端、相手は右寄せ→右端
    const badgeX = lifeX + edgeSign * (lch / 2 + badgeR + 3);
    const badge = new PIXI.Graphics()
      .beginFill(0x000000, 0.85)
      .lineStyle(1, 0xffffff)
      .drawCircle(badgeX, r2Y, badgeR)
      .endFill();
    side.addChild(badge);
    const badgeText = new PIXI.Text(`${n}`, {
      fontSize: badgeR * 1.2,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    badgeText.anchor.set(0.5);
    badgeText.position.set(badgeX, r2Y);
    side.addChild(badgeText);
  }

  // デッキ (getX適用)
  const deck = createCardContainer(
    { uuid: `deck-${p.player_id}`, name: 'Deck' } as VirtualZoneCard, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `deck-${p.player_id}`, name: 'Deck' } as VirtualZoneCard) }
  );
  deck.x = getX(coords.getDeckX(W)); deck.y = r2Y;
  side.addChild(deck);

  // トラッシュ (Sandbox仕様: サイズ縮小 + getX適用)
  const trashCount = z.trash?.length || 0;
  const topTrashCard = z.trash && z.trash.length > 0 ? z.trash[z.trash.length - 1] : null;

  const trash = createCardContainer(
    { 
      uuid: `trash-${p.player_id}`, 
      name: 'Trash', 
      cards: z.trash,
      card_id: topTrashCard ? topTrashCard.card_id : undefined
    } as VirtualZoneCard, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash', cards: z.trash } as VirtualZoneCard), count: trashCount }
  );
  trash.x = getX(coords.getTrashX(W)); trash.y = r3Y;
  side.addChild(trash);

  // ドン!!デッキ (Sandbox仕様: サイズ縮小 + getX適用)
  const donDeckCount = p.don_deck_count ?? 0;
  const donDeck = createCardContainer(
    { uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as VirtualZoneCard, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as VirtualZoneCard), count: donDeckCount }
  );
  donDeck.x = getX(coords.getDonDeckX(W)); donDeck.y = r3Y;
  side.addChild(donDeck);

  // アクティブドン (Sandbox仕様: サイズ縮小 + getX適用)
  const donActiveList = p.don_active || [];
  const donActiveCount = donActiveList.length;
  const donActive = createCardContainer(
    { 
      uuid: `donactive-${p.player_id}`, 
      name: 'Don!! Active',
      card_id: 'DON' 
    } as VirtualZoneCard, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as VirtualZoneCard), count: donActiveCount }
  );
  donActive.x = getX(coords.getDonActiveX(W)); donActive.y = r3Y;
  side.addChild(donActive);

  // レストドン (Sandbox仕様: サイズ縮小 + getX適用)
  const donRestList = p.don_rested || [];
  const donRestCount = donRestList.length;
  const donRest = createCardContainer(
    { 
      uuid: `donrest-${p.player_id}`, 
      name: 'Don!! Rest', 
      is_rest: true,
      card_id: 'DON'
    } as VirtualZoneCard, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as VirtualZoneCard), count: donRestCount }
  );
  donRest.x = getX(coords.getDonRestX(W)); donRest.y = r3Y;
  side.addChild(donRest);

  // 手札 (Sandbox仕様: スクロール廃止、幅調整ロジックに変更)
  const handList = z.hand || [];
  
  // Sandboxの手札配置ロジック
  const maxHandWidth = W * 0.9;
  const cardWidth = coords.CW;
  // 手札全体の必要幅計算
  const totalWidthNeeded = handList.length * cardWidth + (handList.length - 1) * 10;
  
  let stepX = cardWidth + 10;
  let startX = coords.getHandX(0, W);

  // 画面幅を超える場合は隙間を詰める
  if (totalWidthNeeded > maxHandWidth && handList.length > 1) {
      stepX = (maxHandWidth - cardWidth) / (handList.length - 1);
      startX = (W - maxHandWidth) / 2 + cardWidth / 2;
  } else if (handList.length > 0) {
      // 少ない場合は中央寄せ
      const contentWidth = (handList.length - 1) * stepX;
      startX = W / 2 - contentWidth / 2;
  }

  // 手札描画
  handList.forEach((c: CardInstance, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, getCardOpts(c));
    // Sandbox同様に getX で左右反転対応
    card.x = getX(startX + i * stepX);
    card.y = r4Y;
    side.addChild(card);
  });

  return side;
};