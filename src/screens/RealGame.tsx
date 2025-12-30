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
      const battleTypes: Record<string, 'COUNTER' | 'BLOCK'> = {
        'COUNTER': 'COUNTER',
        'BLOCK': 'BLOCK'
      };
      const actionType = battleTypes[type];
      if (actionType) {
        await sendBattleAction(actionType, payload.uuid, pendingRequest.request_id);
        setIsDetailMode(false);
        setSelectedCard(null);
        return;
      }
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
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.CONTROL_BG).drawRect(0, midY - 40, W, 80).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY + 40, W, H - (midY + 40)).endFill();
      app.stage.addChild(bg);

      const onCardClick = async (card: CardInstance) => { 
        if (isPending) return;

        let currentLoc = 'unknown';
        const p1 = gameState.players.p1;
        const p2 = gameState.players.p2;

        if (p1.leader?.uuid === card.uuid) currentLoc = 'leader';
        else if (p1.zones.hand.some((c) => c.uuid === card.uuid)) currentLoc = 'hand';
        else if (p1.zones.field.some((c) => c.uuid === card.uuid)) currentLoc = 'field';
        else if (p1.zones.trash.some((c) => c.uuid === card.uuid)) currentLoc = 'trash';
        else if (p1.zones.life.some((c) => c.uuid === card.uuid)) currentLoc = 'life';
        else if (p2.leader?.uuid === card.uuid) currentLoc = 'opp_leader';
        else if (p2.zones.field.some((c) => c.uuid === card.uuid)) currentLoc = 'opp_field';

        const isPlayer1Turn = activePlayerId === "p1";
        const isPlayer2Turn = activePlayerId === "p2";
        const isP1Card = ['leader', 'hand', 'field', 'life', 'trash'].includes(currentLoc);
        const isP2Card = ['opp_leader', 'opp_field'].includes(currentLoc);
        const isOperatable = (isPlayer1Turn && isP1Card) || (isPlayer2Turn && isP2Card);

        if (isAttackTargeting) {
          const isOpponentOfActive = 
            (activePlayerId === "p1" && (currentLoc === 'opp_leader' || currentLoc === 'opp_field')) ||
            (activePlayerId === "p2" && (currentLoc === 'leader' || currentLoc === 'field'));
          
          if (isOpponentOfActive) {
            logger.log({
              level: 'info',
              action: 'ui.onCardClick.attack',
              msg: `Attack target selected: ${card.uuid} by ${activePlayerId}`,
              payload: { target_id: card.uuid, attacker_id: attackingCardUuid }
            });
            setIsAttackTargeting(false);
            await sendAction('ATTACK' as any, {
              card_id: attackingCardUuid || undefined,
              target_ids: [card.uuid]
            });
            setAttackingCardUuid(null);
            return;
          }
        }

        logger.log({
          level: 'info',
          action: 'ui.onCardClick',
          msg: `Card selected: ${currentLoc}, Turn: ${activePlayerId}, Operatable: ${isOperatable}`,
          payload: { uuid: card.uuid, location: currentLoc, activePlayerId }
        });

        setSelectedCard({ 
          card, 
          location: currentLoc, 
          isMyTurn: isOperatable 
        }); 
        setIsDetailMode(true); 
      };

      const p2Side = createBoardSide(gameState.players.p2, true, W, coords, onCardClick);
      p2Side.x = W;      
      p2Side.y = midY - 40; 
      p2Side.rotation = Math.PI; 
      
      const p1Side = createBoardSide(gameState.players.p1, false, W, coords, onCardClick);
      p1Side.y = midY + 40;

      app.stage.addChild(p2Side, p1Side);
    };

    renderScene();
  }, [gameState, pendingRequest, isAttackTargeting, attackingCardUuid, isPending, sendAction, activePlayerId]);

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {isAttackTargeting && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 110, background: 'rgba(231, 76, 60, 0.9)', padding: '15px', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: '2px solid white' }}>
          攻撃対象を選択してください
          <button onClick={() => { setIsAttackTargeting(false); setAttackingCardUuid(null); }} style={{ marginLeft: '15px', padding: '2px 10px', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}
      {pendingRequest && !isAttackTargeting && 
       (pendingRequest.action === 'SELECT_BLOCKER' || pendingRequest.action === 'SELECT_COUNTER') && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'rgba(0,0,0,0.8)', padding: '15px', borderRadius: '8px', color: 'white', textAlign: 'center', border: '2px solid #f1c40f' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{pendingRequest.message}</div>
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
      />
    )}
    </div>
  );
};
