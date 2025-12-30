import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide } from '../ui/BoardSide';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import type { PendingRequest } from '../api/types';

export const RealGame = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [isAttackTargeting, setIsAttackTargeting] = useState(false);
  const [attackingCardUuid, setAttackingCardUuid] = useState<string | null>(null);

  const activePlayerId = gameState?.turn_info?.active_player_id;

  const { startGame, sendAction, sendBattleAction, isPending } = useGameAction(
    activePlayerId || CONST.PLAYER_KEYS.P1,
    setGameState,
    setPendingRequest,
    pendingRequest
  );

  const handleAction = async (type: string, payload: any = {}) => {
    if (!gameState?.game_id || isPending) return;

    if (type === 'ATTACK') {
      setAttackingCardUuid(payload.uuid);
      setIsAttackTargeting(true);
      setIsDetailMode(false);
      return;
    }

    if (pendingRequest) {
      const battleTypes: Record<string, 'COUNTER' | 'BLOCK'> = {
        'COUNTER': 'COUNTER',
        'BLOCK': 'BLOCK'
      };
      if (battleTypes[type]) {
        await sendBattleAction(battleTypes[type], payload.uuid, pendingRequest.request_id);
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

      const onCardClick = async (card: any) => { 
        if (isPending) return;

        let currentLoc = 'unknown';
        const p1 = gameState.players.p1;
        const p2 = gameState.players.p2;

        if (p1.leader?.uuid === card.uuid) currentLoc = 'leader';
        else if (p1.zones.hand.some((c: any) => c.uuid === card.uuid)) currentLoc = 'hand';
        else if (p1.zones.field.some((c: any) => c.uuid === card.uuid)) currentLoc = 'field';
        else if (p1.zones.trash.some((c: any) => c.uuid === card.uuid)) currentLoc = 'trash';
        else if (p1.zones.life.some((c: any) => c.uuid === card.uuid)) currentLoc = 'life';
        else if (p2.leader?.uuid === card.uuid) currentLoc = 'opp_leader';
        else if (p2.zones.field.some((c: any) => c.uuid === card.uuid)) currentLoc = 'opp_field';

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
      <div style={{ position: 'absolute', top: '10px', right: '10px', color: 'white', background: 'rgba(0,0,0,0.6)', padding: '8px 15px', borderRadius: '5px', fontSize: '0.8rem', borderLeft: `5px solid ${activePlayerId === 'p1' ? '#3498db' : '#e67e22'}`, zIndex: 100 }}>
        現在のターン: <strong>{activePlayerId?.toUpperCase()}</strong>
      </div>

      {isAttackTargeting && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 110, background: 'rgba(231, 76, 60, 0.9)', padding: '15px', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: '2px solid white' }}>
          【{activePlayerId?.toUpperCase()}攻撃中】対象を選択してください
          <button onClick={() => { setIsAttackTargeting(false); setAttackingCardUuid(null); }} style={{ marginLeft: '15px', padding: '2px 10px', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}

      {pendingRequest && !isAttackTargeting && 
       (pendingRequest.action === 'SELECT_BLOCKER' || pendingRequest.action === 'SELECT_COUNTER') && (
        <div style={{ 
          position: 'absolute', 
          top: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          zIndex: 100, 
          background: 'rgba(0,0,0,0.85)', 
          padding: '15px 25px', 
          borderRadius: '12px', 
          color: 'white', 
          textAlign: 'center', 
          border: `3px solid ${pendingRequest.player_id === 'p1' ? '#3498db' : '#e67e22'}`, 
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>
            DEFENSE STEP: {pendingRequest.player_id?.toUpperCase()}
          </div>
          <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '1.1rem' }}>
            {pendingRequest.message}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {pendingRequest.can_skip && (
              <button 
                onClick={handlePass}
                disabled={isPending}
                style={{ 
                  padding: '10px 30px', 
                  backgroundColor: isPending ? '#95a5a6' : '#e74c3c', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: isPending ? 'not-allowed' : 'pointer', 
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                {isPending ? '送信中...' : (pendingRequest.action === 'SELECT_BLOCKER' ? 'ブロックしない' : 'カウンターなし')}
              </button>
            )}
          </div>
          
          <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#f1c40f' }}>
            ※カードをタップして{pendingRequest.action === 'SELECT_BLOCKER' ? 'ブロッカーを選択' : 'カウンター値を追加'}してください
          </div>
        </div>
      )}

      {pendingRequest?.action === 'MAIN_ACTION' && pendingRequest?.player_id === activePlayerId && (
        <button 
          onClick={handleTurnEnd}
          disabled={isPending}
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '10px 20px',
            backgroundColor: isPending ? '#95a5a6' : (activePlayerId === 'p1' ? '#3498db' : '#e67e22'),
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isPending ? 'not-allowed' : 'pointer',
            zIndex: 100,
            fontWeight: 'bold'
          }}
        >
          {isPending ? '送信中...' : `${activePlayerId?.toUpperCase()} ターン終了`}
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
