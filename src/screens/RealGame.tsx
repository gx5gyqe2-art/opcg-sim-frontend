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
    
// 58行目付近に追加
// src/screens/RealGame.tsx 60行目付近

if (type === 'ATTACK_CONFIRM') {
  // 修正：戻り値を result 変数で受け取る
  const result = await sendAction(type as any, {
    card_id: payload.uuid,
    target_ids: payload.target_ids,
  });

// src/screens/RealGame.tsx 70行目付近

  logger.log({
    level: 'info',
    action: 'debug.attack_response',
    msg: 'Response after ATTACK_CONFIRM',
    payload: { 
      // result を any 型として扱うことで TS2339 エラーを回避
      pending: (result as any)?.pending_request,
      turnInfo: (result as any)?.game_state?.turn_info 
    }
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

  // 【追加】アタックターゲット選択中なら、詳細を開かずにアタックを実行
  if (isAttackTargeting && attackingCardUuid) {
    await handleAction('ATTACK_CONFIRM', { 
      uuid: attackingCardUuid, 
      target_ids: [card.uuid] 
    });
    setIsAttackTargeting(false);
    setAttackingCardUuid(null);
    return; // ここで終了させる
  }

  let currentLoc = 'unknown';
  const { p1, p2 } = gameState.players;

  // 1. 各プレイヤーのどのゾーンに存在するかを判定する関数
    const getPhysicalLocation = (playerState: typeof p1, targetCard: CardInstance) => {
      // ダミーID（プレフィックス）での判定を優先
      if (targetCard.uuid.startsWith('life-')) return 'life';
      if (targetCard.uuid.startsWith('trash-')) return 'trash';
      if (targetCard.uuid.startsWith('deck-')) return 'deck';
      if (targetCard.uuid.startsWith('don')) {
// RealGame.tsx 内の判定を ID 生成側（BoardSide）に合わせる
// 91行目付近
if (targetCard.uuid.includes('donactive')) return 'don_active'; // _を消す修正
if (targetCard.uuid.includes('donrest')) return 'don_rest';     // _を消す修正
if (targetCard.uuid.includes('dondeck')) return 'don_deck';     // 追加
      }

      // 通常カードの判定
      if (playerState.leader?.uuid === targetCard.uuid) return 'leader';
      if (playerState.zones.field.some(c => c.uuid === targetCard.uuid)) return 'field';
      if (playerState.zones.hand.some(c => c.uuid === targetCard.uuid)) return 'hand';
      if (playerState.zones.trash.some(c => c.uuid === targetCard.uuid)) return 'trash';
      if (playerState.zones.life.some(c => c.uuid === targetCard.uuid)) return 'life';
      return null;
    };


  const p1Loc = getPhysicalLocation(p1, card);
  const p2Loc = getPhysicalLocation(p2, card);

  // 2. 「現在のターンのプレイヤー（activePlayerId）」を基準に location を翻訳する
  if (activePlayerId === 'p1') {
    if (p1Loc) {
      // P1のターンにP1のカードを触った場合
      currentLoc = p1Loc;
    } else if (p2Loc) {
      // P1のターンにP2のカードを触った場合（すべて opp_ をつける）
      currentLoc = `opp_${p2Loc}`;
    }
  } else if (activePlayerId === 'p2') {
    if (p2Loc) {
      // P2のターンにP2のカードを触った場合（自分として扱うので opp_ なし）
      currentLoc = p2Loc;
    } else if (p1Loc) {
      // P2のターンにP1のカードを触った場合（相手として扱う）
      currentLoc = `opp_${p1Loc}`;
    }
  }

  // 3. 操作可能フラグ（isOperatable）を判定
  // location が 'hand', 'field', 'leader' のいずれかなら、自分のターンの操作対象
  const isOperatable = ['leader', 'hand', 'field'].includes(currentLoc);

  // ログに判定結果を出力（既存ロガーを使用）
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

      // 背景描画
      const bg = new PIXI.Graphics();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.OPPONENT_BG).drawRect(0, 0, W, midY).endFill();
      bg.beginFill(LAYOUT_CONSTANTS.COLORS.PLAYER_BG).drawRect(0, midY, W, H - midY).endFill();
      app.stage.addChild(bg);

      // 視点の入れ替えロジック
      const isP2Turn = activePlayerId === 'p2';
      const bottomPlayer = isP2Turn ? gameState.players.p2 : gameState.players.p1;
      const topPlayer = isP2Turn ? gameState.players.p1 : gameState.players.p2;

      // 上側（相手視点で描画）
      const topSide = createBoardSide(topPlayer, true, W, coords, onCardClick);
      topSide.y = 0; 
      
      // 下側（自分視点で描画）
      const bottomSide = createBoardSide(bottomPlayer, false, W, coords, onCardClick);
      bottomSide.y = midY;

      app.stage.addChild(topSide, bottomSide);
    };

    renderScene();
    // 依存配列に onCardClick で使う変数も入れておく
  }, [gameState, activePlayerId, isAttackTargeting, attackingCardUuid]);  
  // --- ここから追加 ---
  const BATTLE_TYPES = CONST.c_to_s_interface.BATTLE_ACTIONS.TYPES;

  // pendingRequest の変化を監視するログ（切り分け用）
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
  // --- ここまで追加 ---

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
