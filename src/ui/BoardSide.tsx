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

  // ログ：バックエンドから届いた生の枚数関連データを追跡
  logger.log({
    level: 'debug',
    action: 'debug.zone_data_map',
    msg: `Mapping zone data for ${p?.name}`,
    payload: {
      don_deck_count: p?.don_deck_count,
      don_active_len: z.don_active?.length,
      don_rested_len: z.don_rested?.length,
      deck_len: z.deck?.length
    }
  });

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

  if (p.leader) {
    const ldr = createCardContainer(p.leader, coords.CW, coords.CH, { 
      onClick: () => onCardClick(p.leader) 
    });
    ldr.x = coords.getLeaderX(W); 
    ldr.y = r2Y;
    side.addChild(ldr);
  }

  const life = createCardContainer(
    { name: 'Life', location: 'life', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.life) ? z.life.length : 0, onClick: () => {} }
  );
  life.x = coords.getLifeX(W); 
  life.y = r2Y;
  side.addChild(life);

  if (z.stage && z.stage.length > 0) {
    const s = z.stage[0];
    const stageCard = createCardContainer(s, coords.CW, coords.CH, { 
      onClick: () => onCardClick(s) 
    });
    stageCard.x = coords.getStageX(W); 
    stageCard.y = r2Y;
    side.addChild(stageCard);
  }

  // デッキ：zones.deck の要素数を使用
  const deck = createCardContainer(
    { name: 'Deck', location: 'deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.deck) ? z.deck.length : 0, onClick: () => {} }
  );
  deck.x = coords.getDeckX(W); 
  deck.y = r2Y;
  side.addChild(deck);

  // トラッシュ：zones.trash の要素数を使用
  const trash = createCardContainer(
    { name: 'Trash', location: 'trash' }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.trash) ? z.trash.length : 0, onClick: () => {} }
  );
  trash.x = coords.getTrashX(W); 
  trash.y = r3Y;
  side.addChild(trash);

  // ドン!!デッキ：don_deck_count プロパティを直接使用
  const donDeck = createCardContainer(
    { name: 'Don!!', location: 'don_deck', is_face_up: false }, 
    coords.CW, coords.CH, 
    { count: typeof p.don_deck_count === 'number' ? p.don_deck_count : 0, onClick: () => {} }
  );
  donDeck.x = coords.getDonDeckX(W); 
  donDeck.y = r3Y;
  side.addChild(donDeck);

  // ドン!!アクティブ：don_active の要素数を使用
  const donActive = createCardContainer(
    { name: 'Don!!', location: 'don_active' }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.don_active) ? z.don_active.length : 0, onClick: () => {} }
  );
  donActive.x = coords.getDonActiveX(W); 
  donActive.y = r3Y;
  side.addChild(donActive);

  // ドン!!レスト：バックエンドの名称 don_rested に合わせて要素数を使用
  const donRest = createCardContainer(
    { name: 'Don!!', location: 'don_rest' }, 
    coords.CW, coords.CH, 
    { count: Array.isArray(z.don_rested) ? z.don_rested.length : 0, onClick: () => {} }
  );
  donRest.x = coords.getDonRestX(W); 
  donRest.y = r3Y;
  side.addChild(donRest);

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
