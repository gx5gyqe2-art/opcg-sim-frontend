import { useEffect, useRef, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import type { GameState, CardInstance, LeaderCard, BoardCard } from '../types/game';
import { LAYOUT, COLORS } from '../constants/layout';
import { calculateCoordinates } from '../utils/layoutEngine';
import { useGameAction } from '../hooks/useGameAction';
import { ActionMenu } from './ui/ActionMenu';
import { CardDetailSheet } from './ui/CardDetailSheet';

type DrawTarget = CardInstance | LeaderCard | BoardCard | { 
  name: string; is_face_up?: boolean; is_rest?: boolean; power?: number; cost?: number; 
  attribute?: string; counter?: number; attached_don?: number; uuid?: string; text?: string;
};

export const RealGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<{ card: DrawTarget, location: 'hand' | 'field' | 'other' } | null>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);

  // URLからobserverIdを取得、なければデフォルト名
  const urlParams = new URLSearchParams(window.location.search);
  const observerNameFromUrl = urlParams.get('observerId') || 'Player 1';

  // 通信フック
  const { sendAction, startGame, gameId, errorToast, setErrorToast } = useGameAction(
    observerNameFromUrl, 
    (state) => setGameState(state)
  );

  useEffect(() => {
    if (!gameId) startGame();
  }, [gameId, startGame]);

  // --- プレイヤー特定ロジックの強化 ---
  const playerIds = gameState ? Object.keys(gameState.players) : [];
  const currentObserverId = playerIds.find(id => id === observerNameFromUrl) || playerIds[0];

  const handleActionSelect = (actionType: string) => {
    if (!selectedCard || !selectedCard.card.uuid) return;
    const cardUuid = selectedCard.card.uuid;
    switch (actionType) {
      case 'PLAY_CARD': sendAction('PLAY_CARD', { card_id: cardUuid }); break;
      case 'ATTACK': sendAction('ATTACK', { card_id: cardUuid, target_ids: ['dummy'] }); break;
      case 'ATTACH_DON': sendAction('ATTACH_DON', { target_ids: [cardUuid], extra: { count: 1 } }); break;
      case 'ACTIVATE': sendAction('ACTIVATE', { card_id: cardUuid }); break;
    }
    setSelectedCard(null);
  };

  const truncateText = (text: string, style: PIXI.TextStyle, maxWidth: number): string => {
    const metrics = PIXI.TextMetrics.measureText(text, style);
    if (metrics.width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      if (PIXI.TextMetrics.measureText(truncated + '...', style).width <= maxWidth) return truncated + '...';
    }
    return '...';
  };

  // renderCard の型を明示的に指定して循環参照エラーを回避
  const renderCard: (card: DrawTarget, cw: number, ch: number, isOpponent?: boolean, badgeCount?: number, isCountBadge?: boolean, isWideName?: boolean, locationType?: 'hand' | 'field' | 'other') => PIXI.Container = useCallback((card, cw, ch, isOpponent = false, badgeCount, isCountBadge = false, isWideName = false, locationType = 'other') => {
    const container = new PIXI.Container();
    container.eventMode = 'static'; container.cursor = 'pointer';
    let pressTimer: any = null; let isLongPress = false;

    container.on('pointerdown', () => {
      if (isOpponent) return;
      isLongPress = false;
      pressTimer = setTimeout(() => { isLongPress = true; setSelectedCard({ card, location: locationType }); setIsDetailMode(true); }, 400);
    });
    container.on('pointerup', () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (isOpponent || isLongPress) return;
      if (locationType !== 'other') { setSelectedCard({ card, location: locationType }); setIsDetailMode(false); }
    });
    container.on('pointerupoutside', () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
    
    const isRest = 'is_rest' in card && card.is_rest;
    if (isRest) container.rotation = Math.PI / 2;
    if (!isOpponent && 'attached_don' in card && (card.attached_don || 0) > 0) {
      const donBg = new PIXI.Graphics().lineStyle(1, 0x666666).beginFill(COLORS.CARD_BACK).drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6).endFill();
      donBg.x = 6; donBg.y = 6; container.addChild(donBg);
    }
    const isBackSide = 'is_face_up' in card ? card.is_face_up === false : false;
    const g = new PIXI.Graphics().lineStyle(2, COLORS.ZONE_BORDER).beginFill(isBackSide ? COLORS.CARD_BACK : COLORS.ZONE_FILL).drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 6).endFill();
    container.addChild(g);
    const content = new PIXI.Container();
    if (isOpponent) content.rotation = Math.PI;
    container.addChild(content);
    const textRotation = isRest ? -Math.PI / 2 : 0; const yDir = isOpponent ? -1 : 1;

    if (!isBackSide) {
      const name = 'name' in card ? card.name : '';
      const power = 'power' in card ? card.power : undefined;
      const cost = 'cost' in card ? card.cost : undefined;
      const attribute = 'attribute' in card ? (card.attribute as string) : undefined;
      if (power !== undefined) {
        const pTxt = new PIXI.Text(`POWER ${power}`, { fontSize: 11, fill: 0xFF0000, fontWeight: 'bold', align: 'center' });
        pTxt.anchor.set(0.5); pTxt.x = isRest ? (-ch / 2 - 10) * yDir : 0; pTxt.y = isRest ? 0 : (-ch / 2 - 10) * yDir;
        pTxt.rotation = textRotation + (isOpponent ? Math.PI : 0); container.addChild(pTxt);
      }
      const nameStyle = new PIXI.TextStyle({ fontSize: (name === 'DON!!' || name === 'Trash') ? 11 : 9, fill: (name === 'DON!!' || name === 'Trash') ? 0x000000 : 0x333333, fontWeight: 'bold', align: 'center' });
      const nTxt = new PIXI.Text(truncateText(name || '', nameStyle, isWideName ? cw * 2.2 : cw * 1.8), nameStyle);
      nTxt.anchor.set(0.5, (name === 'DON!!' || name === 'Trash') ? 0.5 : 0);
      nTxt.x = isRest ? ( (name === 'DON!!' || name === 'Trash') ? 0 : ch / 2 + 2 ) * yDir : 0;
      nTxt.y = isRest ? 0 : ( (name === 'DON!!' || name === 'Trash') ? 0 : ch / 2 + 2 ) * yDir;
      nTxt.rotation = textRotation + (isOpponent ? Math.PI : 0); container.addChild(nTxt);
      if (attribute && power !== undefined) {
        const aTxt = new PIXI.Text(attribute, { fontSize: 7, fill: 0x666666 });
        aTxt.anchor.set(1, 0); aTxt.x = cw / 2 - 4; aTxt.y = -ch / 2 + 4; content.addChild(aTxt);
      }
      if (cost !== undefined) {
        const cBg = new PIXI.Graphics().beginFill(0x333333).drawCircle(0, 0, 7).endFill();
        cBg.x = -cw / 2 + 10; cBg.y = -ch / 2 + 10;
        const cTxt = new PIXI.Text(cost.toString(), { fontSize: 8, fill: 0xFFFFFF, fontWeight: 'bold' });
        cTxt.anchor.set(0.5); cBg.addChild(cTxt); content.addChild(cBg);
      }
    }
    if (badgeCount !== undefined) {
      const b = new PIXI.Graphics().beginFill(isCountBadge ? 0x333333 : COLORS.BADGE_BG).drawCircle(0, 0, 9).endFill();
      b.x = isRest ? (ch / 2) * yDir : (cw / 2) * yDir;
      b.y = isRest ? (isCountBadge ? -cw / 2 : cw / 2) * yDir : (isCountBadge ? -ch / 2 : ch / 2) * yDir;
      const bt = new PIXI.Text(badgeCount.toString(), { fontSize: 9, fill: 0xFFFFFF, fontWeight: 'bold' });
      bt.anchor.set(0.5); b.rotation = -container.rotation + (isOpponent ? Math.PI : 0); b.addChild(bt); container.addChild(b);
    }
    return container;
  }, []); // 依存配列から renderCard 自体を削除

  const drawLayout = useCallback((state: GameState) => {
    const app = appRef.current; if (!app) return;
    app.stage.removeChildren();
    
    // 現在のObserver/Opponentを動的に特定
    const pIds = Object.keys(state.players);
    const obsId = pIds.find(id => id === observerNameFromUrl) || pIds[0];
    const oppId = pIds.find(id => id !== obsId) || pIds[1];

    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    const coords = calculateCoordinates(W, H);
    const { CH, CW, V_GAP, Y_CTRL_START } = coords;
    const bg = new PIXI.Graphics().beginFill(COLORS.OPPONENT_BG).drawRect(0, 0, W, Y_CTRL_START).endFill().beginFill(COLORS.CONTROL_BG).drawRect(0, Y_CTRL_START, W, LAYOUT.H_CTRL).endFill().beginFill(COLORS.PLAYER_BG).drawRect(0, Y_CTRL_START + LAYOUT.H_CTRL, W, H).endFill();
    app.stage.addChild(bg);

    const renderSide = (p: any, isOpp: boolean) => {
      if (!p) return;
      const side = new PIXI.Container();
      isOpp ? (side.x = W, side.y = Y_CTRL_START, side.rotation = Math.PI) : side.y = Y_CTRL_START + LAYOUT.H_CTRL;
      app.stage.addChild(side);

      // 1. Field参照 (zones.field)
      const fs = p.zones?.field || [];
      fs.forEach((c: any, i: number) => { 
        const card = renderCard(c, CW, CH, isOpp, undefined, false, false, 'field'); 
        card.x = coords.getFieldX(i, W, CW, fs.length); card.y = coords.getY(1, CH, V_GAP); side.addChild(card); 
      });

      const r2Y = coords.getY(2, CH, V_GAP);
      // 2. Life参照 (zones.life)
      const lCount = p.zones?.life?.length || 0;
      const life = renderCard({ is_face_up: false, name: 'Life' }, CW, CH, isOpp, lCount, false, false, 'other');
      life.x = coords.getLifeX(W); life.y = r2Y; side.addChild(life);

      // 3. Leader参照 (直下の leader)
      const ldr = renderCard(p.leader, CW, CH, isOpp, undefined, false, true, 'field');
      ldr.x = coords.getLeaderX(W); ldr.y = r2Y; side.addChild(ldr);

      // 4. Stage参照 (zones.stage)
      if (p.zones?.stage) { 
        const stg = renderCard(p.zones.stage, CW, CH, isOpp, undefined, false, true, 'field'); 
        stg.x = coords.getStageX(W); stg.y = r2Y; side.addChild(stg); 
      }

      const deckCount = p.don_deck_count ?? 40;
      const deck = renderCard({ is_face_up: false, name: 'Deck' }, CW, CH, isOpp, deckCount, false, false, 'other');
      deck.x = coords.getDeckX(W); deck.y = r2Y; side.addChild(deck);

      const r3Y = coords.getY(3, CH, V_GAP);
      const donAct = renderCard({ name: 'DON!!' }, CW, CH, isOpp, p.don_active?.length || 0, true, false, 'other');
      donAct.x = coords.getDonActiveX(W); donAct.y = r3Y; side.addChild(donAct);

      const donRst = renderCard({ name: 'DON!!', is_rest: true }, CW, CH, isOpp, p.don_rested?.length || 0, true, false, 'other');
      donRst.x = coords.getDonRestX(W); donRst.y = r3Y; side.addChild(donRst);

      // 5. Trash参照 (zones.trash)
      const ts = p.zones?.trash || [];
      const trash = renderCard(ts[ts.length - 1] || { name: 'Trash' }, CW, CH, isOpp, ts.length, false, false, 'other');
      trash.x = coords.getTrashX(W); trash.y = r3Y; side.addChild(trash);

      // 6. Hand参照 (zones.hand)
      if (!isOpp) { 
        const hs = p.zones?.hand || [];
        hs.forEach((c: any, i: number) => { 
          const card = renderCard(c, CW, CH, isOpp, undefined, false, false, 'hand'); 
          card.x = coords.getHandX(i, W); card.y = coords.getY(4, CH, V_GAP); side.addChild(card); 
        }); 
      }
    };

    // 確定したIDで描画
    renderSide(state.players[oppId], true);
    renderSide(state.players[obsId], false);
  }, [observerNameFromUrl, renderCard]);

  // Pixi アプリケーション初期化
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;
    const app = new PIXI.Application({ width: window.innerWidth, height: window.innerHeight, backgroundColor: 0xFFFFFF, resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true });
    containerRef.current.appendChild(app.view as HTMLCanvasElement); appRef.current = app;
    const handleResize = () => app.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); app.destroy(true); appRef.current = null; };
  }, []);

  // 描画更新ループ
  useEffect(() => { if (!appRef.current || !gameState) return; drawLayout(gameState); }, [gameState, drawLayout]);

  if (!gameState) {
    return (
      <div style={{ color: 'white', background: 'black', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Connecting to Fleet Server...</div>
        <div style={{ fontSize: '12px', opacity: 0.7 }}>Cloud Run: asia-northeast1</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
      <div style={{ position: 'absolute', top: 40, left: 5, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', pointerEvents: 'none' }}>
        <div>TURN: {gameState.turn_info.turn_count} ({gameState.turn_info.current_phase})</div>
        <div>GAME ID: {gameId}</div>
        <div>OBSERVER: {currentObserverId}</div>
      </div>
      {errorToast && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ff3b30', color: 'white', padding: '12px 20px', borderRadius: '8px', zIndex: 9999, fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', width: '90%', maxWidth: '400px', cursor: 'pointer' }} onClick={() => setErrorToast(null)}>
          {errorToast}
          <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>タップして閉じる</div>
        </div>
      )}
      {selectedCard && !isDetailMode && (
        <ActionMenu cardName={selectedCard.card.name || ''} location={selectedCard.location} onSelect={handleActionSelect} onClose={() => setSelectedCard(null)} />
      )}
      {selectedCard && isDetailMode && (
        <CardDetailSheet card={selectedCard.card} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
};
