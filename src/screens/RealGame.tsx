import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide } from '../ui/BoardSide';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import type { GameState, CardInstance, PendingRequest } from '../game/types';

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<{
    card: CardInstance;
    location: string;
    isMyTurn: boolean;
    // 追加: カードリスト（トラッシュ用）
    cardList?: CardInstance[];
  } | null>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [isAttackTargeting, setIsAttackTargeting] = useState(false);
  const [attackingCardUuid, setAttackingCardUuid] = useState<string | null>(null);

  const activePlayerId = gameState?.turn_info?.active_player_id as "p1" | "p2" | undefined;

  const { startGame, sendAction, sendBattleAction, isPending } = useGameAction(
    activePlayerId || (CONST.PLAYER_KEYS.P1 as "p1"),
    setGameState,
    setPendingRequest,
    pendingRequest
  );

  const handleAction = async (type: string, payload: { uuid?: string; target_ids?: string[]; extra?: any } = {}) => {
    if (!gameState?.game_id || isPending) return;

    if (type === 'ATTACK') {
      setAttackingCardUuid(payload.uuid || null);
      setIsAttackTargeting(true);
      setIsDetailMode(false);
      return;
    }

    if (pendingRequest) {
      const battleTypes: Record<string, string> = {
        'COUNTER': CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_COUNTER,
        'BLOCK': CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_BLOCKER
      };
      const actionType = battleTypes[type];
      if (actionType) {
        await sendBattleAction(actionType, payload.uuid, pendingRequest.request_id);
        setIsDetailMode(false);
        setSelectedCard(null);
        return;
      }
    }
    
    if (type === 'ATTACK_CONFIRM') {
      await sendAction(type as any, {
        card_id: payload.uuid,
        target_ids: payload.target_ids,
      }); 

      setIsDetailMode(false);
      setSelectedCard(null);
      return;
    }

    await sendAction(type as any, {
      card_id: payload.uuid,
      target_ids: payload.target_ids,
      extra: payload.extra
    });
    setIsDetailMode(false);
    setSelectedCard(null);
  };

  const handlePass = async () => {
    if (!pendingRequest || !gameState?.game_id || isPending) return;
    const currentRequestId = pendingRequest.request_id;
    setPendingRequest(null);
    await sendBattleAction('PASS', undefined, currentRequestId);
  };

  const handleTurnEnd = () => {
    handleAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.TURN_END);
  };

  const onCardClick = async (card: CardInstance) => { 
    if (isPending || !gameState) return;

    if (isAttackTargeting && attackingCardUuid) {
      await handleAction('ATTACK_CONFIRM', { 
        uuid: attackingCardUuid, 
        target_ids: [card.uuid] 
      });
      setIsAttackTargeting(false);
      setAttackingCardUuid(null);
      return; 
    }

    let currentLoc = 'unknown';
    const { p1, p2 } = gameState.players;

    const getPhysicalLocation = (playerState: typeof p1, targetCard: CardInstance) => {
      if (targetCard.uuid.startsWith('life-')) return 'life';
      if (targetCard.uuid.startsWith('trash-')) return 'trash';
      if (targetCard.uuid.startsWith('deck-')) return 'deck';
      if (targetCard.uuid.startsWith('don')) {
        if (targetCard.uuid.includes('donactive')) return 'don_active';
        if (targetCard.uuid.includes('donrest')) return 'don_rest';
        if (targetCard.uuid.includes('dondeck')) return 'don_deck';
      }

      if (playerState.leader?.uuid === targetCard.uuid) return 'leader';
      if (playerState.zones.field.some(c => c.uuid === targetCard.uuid)) return 'field';
      if (playerState.zones.hand.some(c => c.uuid === targetCard.uuid)) return 'hand';
      if (playerState.zones.trash.some(c => c.uuid === targetCard.uuid)) return 'trash';
      if (playerState.zones.life.some(c => c.uuid === targetCard.uuid)) return 'life';
      return null;
    };

    const p1Loc = getPhysicalLocation(p1, card);
    const p2Loc = getPhysicalLocation(p2, card);

    if (activePlayerId === 'p1') {
      if (p1Loc) {
        currentLoc = p1Loc;
      } else if (p2Loc) {
        currentLoc = `opp_${p2Loc}`;
      }
    } else if (activePlayerId === 'p2') {
      if (p2Loc) {
        currentLoc = p2Loc;
      } else if (p1Loc) {
        currentLoc = `opp_${p1Loc}`;
      }
    }

    const isOperatable = ['leader', 'hand', 'field'].includes(currentLoc);

    logger.log({
      level: 'info',
      action: "ui.onCardClick",
      msg: `Card: ${card.name}, Loc: ${currentLoc}, Turn: ${activePlayerId}, Operatable: ${isOperatable}`,
      payload: { uuid: card.uuid, activePlayerId, currentLoc }
    });

    // トラッシュクリック時の特別処理
    let trashList: CardInstance[] | undefined = undefined;
    if (card.uuid.startsWith('trash-')) {
      const ownerId = card.uuid.split('-')[1]; // trash-p1 -> p1
      const ownerState = gameState.players[ownerId as 'p1' | 'p2'];
      if (ownerState) {
        trashList = ownerState.zones.trash;
      }
    }

    setSelectedCard({ 
      card, 
      location: currentLoc, 
      isMyTurn: isOperatable,
      cardList: trashList // トラッシュの場合はリストを渡す
    }); 
    setIsDetailMode(true); 
  };
  
  useEffect(() => {
    if (!pixiContainerRef.current) return;

    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    startGame();

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    const renderScene = () => {
      app.stage.removeChildren();
      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
      app.stage.addChild(bg);

      const isP2Turn = activePlayerId === 'p2';
      const bottomPlayer = isP2Turn ? gameState.players.p2 : gameState.players.p1;
      const topPlayer = isP2Turn ? gameState.players.p1 : gameState.players.p2;

      const topSide = createBoardSide(topPlayer, true, W, coords, onCardClick);
      topSide.y = 0; 
      
      const bottomSide = createBoardSide(bottomPlayer, false, W, coords, onCardClick);
      bottomSide.y = midY;

      app.stage.addChild(topSide, bottomSide);
    };

    renderScene();
  }, [gameState, activePlayerId, isAttackTargeting, attackingCardUuid]);  

  const BATTLE_TYPES = CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES;

  useEffect(() => {
    if (pendingRequest) {
      logger.log({
        level: 'info',
        action: 'trace.pending_request_state',
        msg: `Current Pending Action: ${pendingRequest.action}`,
        payload: { action: pendingRequest.action, full: pendingRequest }
      });
    }
  }, [pendingRequest]);

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {isAttackTargeting && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 110, background: 'rgba(231, 76, 60, 0.9)', padding: '15px', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: '2px solid white' }}>
          攻撃対象を選択してください
          <button onClick={() => { setIsAttackTargeting(false); setAttackingCardUuid(null); }} style={{ marginLeft: '15px', padding: '2px 10px', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}
      {pendingRequest && !isAttackTargeting && (
        pendingRequest.action === BATTLE_TYPES.SELECT_BLOCKER || 
        pendingRequest.action === BATTLE_TYPES.SELECT_COUNTER
      ) && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'rgba(0,0,0,0.8)', padding: '15px', borderRadius: '8px', color: 'white', textAlign: 'center', border: '2px solid #f1c40f' }}>

          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            [{pendingRequest.action}] {pendingRequest.message}
          </div>
          <div style={{ fontSize: '12px', color: '#f1c40f', marginBottom: '10px' }}>
            {gameState?.active_battle 
              ? `ATTACK: ${gameState.active_battle.attacker_uuid.slice(0,8)} → ${gameState.active_battle.target_uuid.slice(0,8)}` 
              : "BATTLE DATA LOADING..."}
          </div>

          {pendingRequest.can_skip && (
            <button 
              onClick={handlePass}
              disabled={isPending}
              style={{ 
                padding: '8px 24px', 
                backgroundColor: isPending ? '#95a5a6' : '#e74c3c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: isPending ? 'not-allowed' : 'pointer', 
                fontWeight: 'bold' 
              }}
            >
              {isPending ? '送信中...' : 'パス'}
            </button>
          )}
        </div>
      )}
      {pendingRequest?.action === 'MAIN_ACTION' && (
        <button 
          onClick={handleTurnEnd}
          disabled={isPending}
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '10px 20px',
            backgroundColor: isPending ? '#95a5a6' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            zIndex: 100,
            fontWeight: 'bold'
          }}
        >
          {isPending ? '送信中...' : 'ターン終了'}
        </button>
      )}

    {isDetailMode && selectedCard && (
      <CardDetailSheet
        card={selectedCard.card}
        location={selectedCard.location}
        isMyTurn={selectedCard.isMyTurn}
        onAction={handleAction}
        onClose={() => {
          setIsDetailMode(false);
          setSelectedCard(null);
        }}
        cardList={selectedCard.cardList} // 追加
      />
    )}
    </div>
  );
};
