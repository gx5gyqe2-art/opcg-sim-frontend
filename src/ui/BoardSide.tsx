import * as PIXI from 'pixi.js';
import type { LayoutCoords } from '../layout/layoutEngine';
import { createCardContainer } from './CardRenderer';
import { logger } from '../utils/logger';

export const createBoardSide = (
  p: any, 
  _isOpp: boolean, 
  W: number, 
  coords: LayoutCoords, 
  onCardClick: (card: any) => void
) => {
  const side = new PIXI.Container();
  const z = p?.zones || {};

  // 1. フィールド（キャラクター）
  (z.field || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, { 
      onClick: () => onCardClick(c) 
    });
    card.x = coords.getFieldX(i, W, coords.CW, z.field.length);
    card.y = coords.getY(1, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  const r2Y = coords.getY(2, coords.CH, coords.V_GAP);
  const r3Y = coords.getY(3, coords.CH, coords.V_GAP);

  // 2. リーダー
  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, { 
      onClick: () => onCardClick(p.leader) 
    });
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  // 3. ライフ
  const lifeCount = Array.isArray(z.life) ? z.life.length : 0;
  const life = createCardContainer(
    { name: 'Life', location: 'life', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: lifeCount, onClick: () => {} }
  );
  life.x = coords.getLifeX(W); 
  life.y = r2Y;
  side.addChild(life);

  // 4. ステージ
  if (z.stage && z.stage.length > 0) {
    const s = z.stage[0];
    const stageCard = createCardContainer(s, coords.CW, coords.CH, { 
      onClick: () => onCardClick(s) 
    });
    stageCard.x = coords.getStageX(W); 
    stageCard.y = r2Y;
    side.addChild(stageCard);
  }

  // 5. 山札 (BE修正待ち: z.deck を参照)
  const deckCount = Array.isArray(z.deck) ? z.deck.length : 0;
  const deck = createCardContainer(
    { name: 'Deck', location: 'deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: deckCount, onClick: () => {} }
  );
  deck.x = coords.getDeckX(W); 
  deck.y = r2Y;
  side.addChild(deck);

  // 6. トラッシュ
  const trashCount = Array.isArray(z.trash) ? z.trash.length : 0;
  const trash = createCardContainer(
    { name: 'Trash', location: 'trash' }, 
    coords.CW, coords.CH, 
    { count: trashCount, onClick: () => {} }
  );
  trash.x = coords.getTrashX(W); 
  trash.y = r3Y;
  side.addChild(trash);

  // 7. ドン!!デッキ (Player直下の数値)
  const donDeckCount = p.don_deck_count ?? p.donDeckCount ?? 0;
  const donDeck = createCardContainer(
    { name: 'Don!!', location: 'don_deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: donDeckCount, onClick: () => {} }
  );
  donDeck.x = coords.getDonDeckX(W); 
  donDeck.y = r3Y;
  side.addChild(donDeck);

  // 8. ドン!!アクティブ (Player直下の配列)
  const donActiveCount = Array.isArray(p.don_active) ? p.don_active.length : 0;
  const donActive = createCardContainer(
    { name: 'Don!!', location: 'don_active' }, 
    coords.CW, coords.CH, 
    { count: donActiveCount, onClick: () => {} }
  );
  donActive.x = coords.getDonActiveX(W); 
  donActive.y = r3Y;
  side.addChild(donActive);

  // 9. ドン!!レスト (Player直下の配列 don_rested)
  const donRestCount = Array.isArray(p.don_rested) ? p.don_rested.length : 0;
  const donRest = createCardContainer(
    { name: 'Don!!', location: 'don_rest' }, 
    coords.CW, coords.CH, 
    { count: donRestCount, onClick: () => {} }
  );
  donRest.x = coords.getDonRestX(W); 
  donRest.y = r3Y;
  side.addChild(donRest);

  // 10. 手札 (重なりを防ぎ、横に並べる配置)
  const handCards = z.hand || [];
  const HAND_GAP = 10;
  const cardWidth = coords.CW;

  handCards.forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, { 
      onClick: () => onCardClick(c) 
    });
    // 左端から固定間隔で配置。枚数が多いと画面外(右)に伸びる。
    card.x = i * (cardWidth + HAND_GAP) + cardWidth / 2 + 20;
    card.y = coords.getY(4, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  logger.log({
    level: 'info',
    action: 'ui.render_board_side',
    msg: `Rendered BoardSide for ${p?.name || 'unknown'}`,
    payload: { 
      lifeCount, 
      deckCount, 
      trashCount, 
      donDeckCount, 
      donActiveCount, 
      donRestCount,
      handCount: handCards.length 
    }
  });

  return side;
};