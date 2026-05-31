import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { LAYOUT_CONSTANTS, LAYOUT_PARAMS } from '../layout/layout.config';
import { calculateCoordinates } from '../layout/layoutEngine';
import { createBoardSide } from '../ui/BoardSide';
import { useGameAction } from '../game/actions';
import { CardDetailSheet } from '../ui/CardDetailSheet';
import { CardSelectModal } from '../ui/CardSelectModal';
import { DebugReporter } from '../ui/DebugReporter';
import { DeckSelectModal, type DeckOption } from '../ui/DeckSelectModal';
import { API_CONFIG } from '../api/api.config';
import { getCardImageUrl } from '../utils/imageAssets';
import CONST from '../../shared_constants.json';
import { logger } from '../utils/logger';
import type { GameState, CardInstance, PendingRequest } from '../game/types';


export const RealGame = ({ p1Deck: initialP1, p2Deck: initialP2, onBack }: { p1Deck: string, p2Deck: string, onBack: () => void }) => {
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
  
  const [layoutCoords, setLayoutCoords] = useState<{ x: number, y: number } | null>(null);
  
  const [p1DeckId, setP1DeckId] = useState(initialP1 || 'imu.json');
  const [p2DeckId, setP2DeckId] = useState(initialP2 || 'nami.json');
  const [isSetupComplete, setIsSetupComplete] = useState(!!(initialP1 && initialP2));
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [selectingDeckFor, setSelectingDeckFor] = useState<'p1' | 'p2' | null>(null);

  const { COLORS } = LAYOUT_CONSTANTS;
  const { Z_INDEX, ALPHA } = LAYOUT_PARAMS;

  const activePlayerId = gameState?.turn_info?.active_player_id as "p1" | "p2" | undefined;

  const { startGame, sendAction, sendBattleAction, isPending, errorToast, setErrorToast } = useGameAction(
    activePlayerId || (CONST.PLAYER_KEYS.P1 as "p1"),
    setGameState,
    setPendingRequest,
    pendingRequest
  );

  useEffect(() => {
    if (isSetupComplete) return;

    const fetchDecks = async () => {
      const options: DeckOption[] = [];
      try {
        const localIds = JSON.parse(localStorage.getItem('opcg_local_deck_ids') || '[]');
        localIds.forEach((id: string) => {
          const deckData = localStorage.getItem(`opcg_deck_${id}`);
          if (deckData) {
            const parsed = JSON.parse(deckData);
            options.push({ id: id, name: parsed.name || `Local Deck ${id}`, leaderId: parsed.leader_id });
          }
        });
      } catch(e) { console.error(e); }

      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        if (data.success) {
          data.decks.forEach((d: any) => { 
            if (!d.id.endsWith('.json')) {
              options.push({ id: `db:${d.id}`, name: d.name, leaderId: d.leader_id }); 
            }
          });
        }
      } catch(e) { console.error(e); }

      options.unshift(
        { id: 'imu.json', name: 'Imu (Default)', leaderId: 'ST01-001' },
        { id: 'nami.json', name: 'Nami (Default)', leaderId: 'OP03-040' }
      );

      const uniqueMap = new Map();
      options.forEach(o => uniqueMap.set(o.id, o));
      setDeckOptions(Array.from(uniqueMap.values()));
    };
    fetchDecks();
  }, [isSetupComplete]);

  const handleGameStart = () => {
    if (p1DeckId && p2DeckId) {
      setIsSetupComplete(true);
    }
  };

  const handleSelectionResolve = async (selectedUuids: string[]) => {
    if (!gameState?.game_id || !pendingRequest) return;
    
    const battleActionTypes = Object.values(CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES);
    
    if (battleActionTypes.includes(pendingRequest.action)) {
      await sendBattleAction(pendingRequest.action as any, selectedUuids[0], pendingRequest.request_id);
    } else {
      await sendAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.RESOLVE_EFFECT_SELECTION, {
        extra: { selected_uuids: selectedUuids }
      });
    }
  };

  const handleOptionSelect = async (index: number) => {
    if (!gameState?.game_id || isPending) return;
    
    await sendAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.RESOLVE_EFFECT_SELECTION, {
      extra: { index: index }
    });
  };

  const handleAction = async (type: string, payload: { uuid?: string; target_ids?: string[]; extra?: any } = {}) => {
    if (!gameState?.game_id || isPending) return;

    if (type === CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ATTACK) {
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
    
    if (type === CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ATTACK_CONFIRM) {
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
    await sendBattleAction(CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.PASS, undefined, currentRequestId);
  };

  const handleTurnEnd = () => {
    handleAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.TURN_END);
  };

  const onCardClick = async (card: CardInstance) => { 
    if (isPending || !gameState) return;

    if (isAttackTargeting && attackingCardUuid) {
      await handleAction(CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ATTACK_CONFIRM, { 
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
      if (playerState.stage?.uuid === targetCard.uuid) return 'field';
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

    setSelectedCard({ 
      card, 
      location: currentLoc, 
      isMyTurn: isOperatable 
    }); 
    setIsDetailMode(true); 
  };
  
  useEffect(() => {
    if (!pixiContainerRef.current || !isSetupComplete) return;

    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: COLORS.APP_BG,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const coords = calculateCoordinates(window.innerWidth, window.innerHeight);
    setLayoutCoords(coords.turnEndPos);

    startGame(p1DeckId, p2DeckId);

    const handleResize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
      const newCoords = calculateCoordinates(window.innerWidth, window.innerHeight);
      setLayoutCoords(newCoords.turnEndPos);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      app.destroy(true, { children: true });
    };
  }, [isSetupComplete]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !gameState) return;

    const renderScene = () => {
      while (app.stage.children.length > 0) {
        const child = app.stage.children[0];
        app.stage.removeChild(child);
        child.destroy({ children: true });
      }

      const { width: W, height: H } = app.screen;
      const coords = calculateCoordinates(W, H);
      const midY = H / 2;

      const bg = new PIXI.Graphics();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
      app.stage.addChild(bg);

      const border = new PIXI.Graphics();
      border.lineStyle(2, COLORS.BORDER_LINE, ALPHA.BORDER_LINE);
      border.moveTo(0, midY);
      border.lineTo(W, midY);
      app.stage.addChild(border);

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

  useEffect(() => {
    const handleBeforeUnload = () => {
      logger.flushLogs();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleBackToTitle = () => {
    logger.flushLogs();
    onBack();
  };

  if (!isSetupComplete) {
    const getLeaderImage = (deckId: string) => {
      const opt = deckOptions.find(d => d.id === deckId);
      return opt?.leaderId ? getCardImageUrl(opt.leaderId) : null;
    };
    const getDeckName = (deckId: string) => {
      const opt = deckOptions.find(d => d.id === deckId);
      return opt?.name || deckId;
    };

    return (
      <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at center, #2c3e50 0%, #000000 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ 
          background: '#2c3e50', padding: '30px', borderRadius: '12px', border: '2px solid #7f8c8d', 
          width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: '#ecf0f1'
        }}>
          <h2 style={{ color: '#f1c40f', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #7f8c8d', paddingBottom: '10px', margin: 0 }}>
            VS CPU SETUP
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>Player 1 (あなた)</label>
            <div 
              onClick={() => setSelectingDeckFor('p1')}
              style={{ 
                height: '60px', background: '#2a1a1a', border: '1px solid #5d4037', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative'
              }}
            >
              {p1DeckId ? (
                <>
                  <img src={getLeaderImage(p1DeckId) || ''} alt="leader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <span style={{ zIndex: 1, fontWeight: 'bold', textShadow: '0 2px 4px black' }}>{getDeckName(p1DeckId)}</span>
                </>
              ) : (
                <span style={{ color: '#7f8c8d', fontSize: '14px' }}>＋ デッキを選択</span>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#95a5a6', fontStyle: 'italic', margin: '-10px 0' }}>VS</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ color: '#bdc3c7', fontSize: '12px', fontWeight: 'bold' }}>Player 2 (CPU)</label>
            <div 
              onClick={() => setSelectingDeckFor('p2')}
              style={{ 
                height: '60px', background: '#2a1a1a', border: '1px solid #5d4037', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative'
              }}
            >
              {p2DeckId ? (
                <>
                  <img src={getLeaderImage(p2DeckId) || ''} alt="leader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <span style={{ zIndex: 1, fontWeight: 'bold', textShadow: '0 2px 4px black' }}>{getDeckName(p2DeckId)}</span>
                </>
              ) : (
                <span style={{ color: '#7f8c8d', fontSize: '14px' }}>＋ デッキを選択</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={onBack} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #95a5a6', color: '#95a5a6', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              キャンセル
            </button>
            <button 
              onClick={handleGameStart} 
              disabled={!p1DeckId || !p2DeckId}
              style={{ 
                flex: 1, padding: '12px', 
                background: (p1DeckId && p2DeckId) ? '#e67e22' : '#34495e', 
                color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', 
                cursor: (p1DeckId && p2DeckId) ? 'pointer' : 'not-allowed'
              }}
            >
              GAME START
            </button>
          </div>
        </div>

        {selectingDeckFor && (
          <DeckSelectModal 
            title={`デッキを選択 (${selectingDeckFor.toUpperCase()})`}
            options={deckOptions}
            onSelect={(deckId) => {
              if (selectingDeckFor === 'p1') setP1DeckId(deckId);
              else setP2DeckId(deckId);
              setSelectingDeckFor(null);
            }}
            onClose={() => setSelectingDeckFor(null)}
          />
        )}
      </div>
    );
  }

  const showSearchModal = 
    pendingRequest?.action === CONST.c_to_s_interface.PENDING_ACTION_TYPES.SEARCH_AND_SELECT ||
    pendingRequest?.action === CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES.SELECT_COUNTER;
    
  const constraints = pendingRequest?.constraints || {};

  const modalCandidates = pendingRequest?.candidates || (
    (gameState && pendingRequest?.selectable_uuids) ? 
      [
        ...gameState.players.p1.zones.hand, 
        ...gameState.players.p1.zones.field, 
        ...gameState.players.p2.zones.hand, 
        ...gameState.players.p2.zones.field,
        gameState.players.p1.leader,
        gameState.players.p2.leader
      ].filter((c): c is CardInstance => !!c && pendingRequest.selectable_uuids!.includes(c.uuid)) 
      : []
  );

  const activeDonCount = gameState && activePlayerId 
    ? (gameState.players[activePlayerId] as any).don_active.length 
    : 0;

  return (
    <div ref={pixiContainerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      <button 
        onClick={handleBackToTitle}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: Z_INDEX.OVERLAY + 20,
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          border: '1px solid #555',
          borderRadius: '4px',
          padding: '5px 10px',
          cursor: 'pointer'
        }}
      >
        TOPへ
      </button>

      {errorToast && (
        <div style={{
          position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: Z_INDEX.OVERLAY + 10, backgroundColor: '#e74c3c', color: 'white',
          padding: '10px 20px', borderRadius: '5px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', border: '1px solid white'
        }}>
          <span>⚠️ {errorToast}</span>
          <button onClick={() => setErrorToast(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer', marginLeft: '10px' }}>×</button>
        </div>
      )}

      {isAttackTargeting && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: Z_INDEX.OVERLAY, background: COLORS.OVERLAY_ATTACK_BG, padding: '15px', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: '2px solid white' }}>
          攻撃対象を選択してください
          <button onClick={() => { setIsAttackTargeting(false); setAttackingCardUuid(null); }} style={{ marginLeft: '15px', padding: '2px 10px', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}

      {pendingRequest && !isAttackTargeting && !showSearchModal && pendingRequest.action !== 'MAIN_ACTION' && (
        <div style={{ 
            position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', 
            zIndex: Z_INDEX.NOTIFICATION, background: COLORS.OVERLAY_INFO_BG, 
            padding: '15px', borderRadius: '8px', color: 'white', textAlign: 'center', 
            border: `2px solid ${COLORS.OVERLAY_BORDER_HIGHLIGHT}` 
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            [{pendingRequest.action}] {pendingRequest.message}
          </div>
          {gameState?.active_battle && (
            <div style={{ fontSize: '12px', color: COLORS.OVERLAY_BORDER_HIGHLIGHT, marginBottom: '10px' }}>
              {`ATTACK: ${gameState.active_battle.attacker_uuid.slice(0,8)} → ${gameState.active_battle.target_uuid.slice(0,8)}`}
            </div>
          )}

          {(pendingRequest as any).options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              {(pendingRequest as any).options.map((label: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isPending}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: COLORS.BTN_PRIMARY,
                    color: 'white',
                    border: '1px solid white',
                    borderRadius: '4px',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {pendingRequest.can_skip && (
            <button 
              onClick={handlePass} disabled={isPending}
              style={{ 
                padding: '8px 24px', backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_DANGER, 
                color: 'white', border: 'none', borderRadius: '4px', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 'bold' 
              }}
            >
              {isPending ? '送信中...' : 'パス'}
            </button>
          )}
        </div>
      )}

      {(pendingRequest?.action === CONST.c_to_s_interface.GAME_ACTIONS.TYPES.ACTIVATE_MAIN || pendingRequest?.action === 'MAIN_ACTION') && (
        <button 
          onClick={handleTurnEnd} disabled={isPending}
          style={{
            position: 'absolute',
            left: layoutCoords ? `${layoutCoords.x}px` : 'auto',
            top: layoutCoords ? `${layoutCoords.y}px` : '50%',
            right: layoutCoords ? 'auto' : '20px',
            transform: 'translateY(-50%)',
            padding: '10px 20px',
            backgroundColor: isPending ? COLORS.BTN_DISABLED : COLORS.BTN_PRIMARY,
            color: 'white', border: 'none', borderRadius: '5px',
            cursor: isPending ? 'not-allowed' : 'pointer', zIndex: Z_INDEX.NOTIFICATION, fontWeight: 'bold'
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
        activeDonCount={activeDonCount}
        onAction={handleAction}
        onClose={() => {
          setIsDetailMode(false);
          setSelectedCard(null);
        }}
      />
    )}

    {showSearchModal && modalCandidates.length > 0 && (
      <CardSelectModal
        key={pendingRequest?.request_id} 
        candidates={modalCandidates}
        message={pendingRequest?.message || ""}
        minSelect={constraints.min ?? 1}
        maxSelect={constraints.max ?? 1}
        onConfirm={handleSelectionResolve}
        onCancel={pendingRequest?.can_skip ? handlePass : undefined}
      />
    )}

    <DebugReporter 
      data={{ 
        gameState, 
        pendingRequest,
        activePlayerId,
        attackingCardUuid
      }} 
    />

    </div>
  );
};
