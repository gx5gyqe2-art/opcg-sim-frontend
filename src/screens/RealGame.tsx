import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide } from '../ui/BoardSide';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import CONST from '../../shared_constants.json';
import { apiClient } from '../api/client';
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

  const { startGame, sendBattleAction, isPending } = useGameAction(
    CONST.PLAYER_KEYS.P1, 
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

    try {
      const result = await apiClient.sendAction(gameState.game_id, {
        request_id: Math.random().toString(36).substring(2, 15),
        action_type: type as any,
        player_id: pendingRequest?.player_id || CONST.PLAYER_KEYS.P1,
        card_id: payload.uuid,
        target_ids: payload.target_ids,
        extra: payload.extra
      });

      if (result.game_state) {
        setGameState(result.game_state);
        setPendingRequest(result.pending_request || null);
        setIsDetailMode(false);
        setSelectedCard(null);
      }
    } catch (err) {
      logger.log({
        level: 'error',
        action: 'game.action_error',
        msg: 'Failed to execute action',
        payload: { err, type, payload }
      });
    }
  };

  const handlePass = async () => {
    if (!pendingRequest || !gameState?.game_id || isPending) return;
    await sendBattleAction('PASS', undefined, pendingRequest.request_id);
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

        if (isAttackTargeting) {
          if (currentLoc === 'opp_leader' || currentLoc === 'opp_field') {
            setIsAttackTargeting(false);
            try {
              const result = await apiClient.sendAction(gameState.game_id, {
                request_id: Math.random().toString(36).substring(2, 15),
                action_type: 'ATTACK' as any,
                player_id: pendingRequest?.player_id || CONST.PLAYER_KEYS.P1,
                card_id: attackingCardUuid || undefined,
                target_ids: [card.uuid]
              });
              if (result.game_state) {
                setGameState(result.game_state);
                setPendingRequest(result.pending_request || null);
              }
            } catch (err) {
              logger.log({ level: 'error', action: 'game.attack_error', msg: 'Attack failed', payload: { err } });
            }
            setAttackingCardUuid(null);
          }
          return;
        }

        if (pendingRequest) {
          if (!pendingRequest.selectable_uuids.includes(card.uuid)) return;
        }

        logger.log({
          level: 'info',
          action: 'ui.onCardClick',
          msg: `Card selected in ${currentLoc}`,
          payload: { uuid: card.uuid, location: currentLoc }
        });

        setSelectedCard({ card, location: currentLoc }); 
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
  }, [gameState, pendingRequest, isAttackTargeting, attackingCardUuid, isPending]);

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {isAttackTargeting && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 110, background: 'rgba(231, 76, 60, 0.9)', padding: '15px', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: '2px solid white' }}>
          攻撃対象を選択してください
          <button onClick={() => { setIsAttackTargeting(false); setAttackingCardUuid(null); }} style={{ marginLeft: '15px', padding: '2px 10px', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}
      {pendingRequest && !isAttackTargeting && pendingRequest.type !== 'MAIN_ACTION' && (
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
      {isDetailMode && selectedCard && (
        <CardDetailSheet
          card={selectedCard.card}
          location={selectedCard.location}
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
