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

  // デバッグロガー：バックエンドから届いた枚数関連のプロパティをチェック
  logger.log({
    level: 'debug',
    action: 'debug.board_side_data',
    msg: `Mapping zones for ${p?.name || 'unknown player'}`,
    payload: {
      deck_len: z.deck?.length,
      trash_len: z.trash?.length,
      don_active_len: z.don_active?.length,
      don_rested_len: z.don_rested?.length,
      don_deck_count: p?.don_deck_count
    }
  });

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
  const life = createCardContainer(
    { name: 'Life', location: 'life', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.life) ? z.life.length : 0, onClick: () => {} }
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

  // 5. 山札（zones.deck のリスト長）
  const deck = createCardContainer(
    { name: 'Deck', location: 'deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.deck) ? z.deck.length : 0, onClick: () => {} }
  );
  deck.x = coords.getDeckX(W); 
  deck.y = r2Y;
  side.addChild(deck);

  // 6. トラッシュ（zones.trash のリスト長）
  const trash = createCardContainer(
    { name: 'Trash', location: 'trash' }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.trash) ? z.trash.length : 0, onClick: () => {} }
  );
  trash.x = coords.getTrashX(W); 
  trash.y = r3Y;
  side.addChild(trash);

  // 7. ドン!!デッキ（プレイヤー直下の don_deck_count 数値）
  const donDeck = createCardContainer(
    { name: 'Don!!', location: 'don_deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: typeof p.don_deck_count === 'number' ? p.don_deck_count : 0, onClick: () => {} }
  );
  donDeck.x = coords.getDonDeckX(W); 
  donDeck.y = r3Y;
  side.addChild(donDeck);

  // 8. ドン!!アクティブ（don_active のリスト長）
  const donActive = createCardContainer(
    { name: 'Don!!', location: 'don_active' }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.don_active) ? z.don_active.length : 0, onClick: () => {} }
  );
  donActive.x = coords.getDonActiveX(W); 
  donActive.y = r3Y;
  side.addChild(donActive);

  // 9. ドン!!レスト（バックエンド名 don_rested のリスト長）
  const donRest = createCardContainer(
    { name: 'Don!!', location: 'don_rest' }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.don_rested) ? z.don_rested.length : 0, onClick: () => {} }
  );
  donRest.x = coords.getDonRestX(W); 
  donRest.y = r3Y;
  side.addChild(donRest);

  // 10. 手札
  (z.hand || []).forEach((c: any, i: number) => {
    const card = createCardContainer(c, coords.CW, coords.CH, { 
      onClick: () => onCardClick(c) 
    });
    card.x = coords.getHandX(i, W);
    card.y = coords.getY(4, coords.CH, coords.V_GAP);
    side.addChild(card);
  });

  return side;
};
