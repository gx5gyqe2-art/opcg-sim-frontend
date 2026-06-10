import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';
import type { PlayerState, CardInstance, BoardCard } from '../game/types';
import { logger } from '../utils/logger';
// 未使用のインポートを削除しました

export const createBoardSide = (
  p: PlayerState,
  isOpponent: boolean,
  W: number,
  coords: LayoutCoords,
  onCardClick: (card: CardInstance) => void,
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

  const getCardOpts = (c: Partial<CardInstance>) => ({
    onClick: () => onCardClick(c as CardInstance),
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
  let fieldCards = [...(z.field || [])]; 

  if (!stageCard) {
    const sIdx = fieldCards.findIndex(c => {
        const t = c.type?.toUpperCase();
        return t === 'STAGE' || t === 'ステージ';
    });

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

  // ライフ (getX適用)
  const lifeCount = z.life?.length || 0;
  const life = createCardContainer(
    { uuid: `life-${p.player_id}`, name: 'Life' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `life-${p.player_id}`, name: 'Life' } as any), count: lifeCount }
  );
  life.x = getX(coords.getLifeX(W)); life.y = r2Y;
  side.addChild(life);

  // デッキ (getX適用)
  const deck = createCardContainer(
    { uuid: `deck-${p.player_id}`, name: 'Deck' } as any, 
    coords.CW, 
    coords.CH, 
    { ...getCardOpts({ uuid: `deck-${p.player_id}`, name: 'Deck' } as any) }
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
    } as any, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `trash-${p.player_id}`, name: 'Trash', cards: z.trash } as any), count: trashCount }
  );
  trash.x = getX(coords.getTrashX(W)); trash.y = r3Y;
  side.addChild(trash);

  // ドン!!デッキ (Sandbox仕様: サイズ縮小 + getX適用)
  const donDeckCount = (p as any).don_deck_count ?? 0;
  const donDeck = createCardContainer(
    { uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `dondeck-${p.player_id}`, name: 'Don!! Deck' } as any), count: donDeckCount }
  );
  donDeck.x = getX(coords.getDonDeckX(W)); donDeck.y = r3Y;
  side.addChild(donDeck);

  // アクティブドン (Sandbox仕様: サイズ縮小 + getX適用)
  const donActiveList = (p as any).don_active || [];
  const donActiveCount = donActiveList.length;
  const donActive = createCardContainer(
    { 
      uuid: `donactive-${p.player_id}`, 
      name: 'Don!! Active',
      card_id: 'DON' 
    } as any, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `donactive-${p.player_id}`, name: 'Don!! Active' } as any), count: donActiveCount }
  );
  donActive.x = getX(coords.getDonActiveX(W)); donActive.y = r3Y;
  side.addChild(donActive);

  // レストドン (Sandbox仕様: サイズ縮小 + getX適用)
  const donRestList = (p as any).don_rested || [];
  const donRestCount = donRestList.length;
  const donRest = createCardContainer(
    { 
      uuid: `donrest-${p.player_id}`, 
      name: 'Don!! Rest', 
      is_rest: true,
      card_id: 'DON'
    } as any, 
    smallCW, // 変更
    smallCH, // 変更
    { ...getCardOpts({ uuid: `donrest-${p.player_id}`, name: 'Don!! Rest' } as any), count: donRestCount }
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