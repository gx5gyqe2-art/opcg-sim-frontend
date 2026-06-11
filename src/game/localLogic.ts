import { v4 as uuidv4 } from 'uuid';
import type { GameState, CardInstance, PlayerState, LeaderCard, BoardCard, DeckInput, DeckCardData, ZoneState } from './types';
import { logger } from '../utils/logger';

const cloneState = (state: GameState): GameState => JSON.parse(JSON.stringify(state));

const updatePlayerCounts = (player: PlayerState) => {
  player.don_deck_count = player.zones.don_deck ? player.zones.don_deck.length : 0;
  player.don_count = player.don_active.length + player.don_rested.length + player.don_attached.length;
  player.active_don = player.don_active.length;
};

export const createInitialGameState = (p1Deck: DeckInput, p2Deck: DeckInput, roomName: string): GameState => {
  const setupPlayer = (deck: DeckInput, playerId: string, name: string): PlayerState => {
    const leaderRaw: DeckCardData | null =
      (deck?.leader && Array.isArray(deck.leader) ? deck.leader[0] : (deck?.leader as DeckCardData | undefined)) ||
      (deck?.cards && deck.cards.find((c: DeckCardData) => (c.type || '').toUpperCase() === 'LEADER')) ||
      null;
    
    let leader: LeaderCard | null = null;
    if (leaderRaw) {
      // ▼ 修正: ID解決ロジックを強化
      const originalId = leaderRaw.card_id || leaderRaw.uuid || leaderRaw.number || leaderRaw.id || "LEADER";
      
      leader = {
        name: "Unknown Leader",
        power: 5000,
        ...leaderRaw,
        card_id: originalId, // 確実に設定
        uuid: uuidv4(),      // 新しいUUIDを発行
        owner_id: playerId,
        is_rest: false,
        attached_don: 0,
        type: "LEADER"
      } as LeaderCard;
    }

    const mainCards = (deck?.cards || [])
      .filter((c: DeckCardData) => (c.type || '').toUpperCase() !== 'LEADER')
      .map((c: DeckCardData) => ({
        ...c,
        // ▼ 修正: メインカードも同様にIDを確保
        card_id: c.card_id || c.uuid || c.number || c.id,
        uuid: uuidv4(),
        owner_id: playerId,
        is_rest: false,
        attached_don: 0,
        is_face_up: false
      } as CardInstance));

    const shuffled = [...mainCards].sort(() => Math.random() - 0.5);

    const hand = shuffled.slice(0, 5).map(c => ({ ...c, is_face_up: true }));
    const lifeCount = leader?.life || 5;
    const life = shuffled.slice(5, 5 + lifeCount);
    const deckCards = shuffled.slice(5 + lifeCount);

    const playerState: PlayerState = {
      player_id: playerId,
      name: name,
      leader: leader,
      stage: null,
      zones: {
        field: [],
        hand: hand,
        life: life,
        trash: [],
        deck: deckCards,
        don_deck: Array.from({ length: 10 }, () => ({
          uuid: uuidv4(), card_id: "DON", owner_id: playerId, name: "DON!!", type: "DON", is_rest: false, is_face_up: false
        }))
      },
      don_count: 0,
      active_don: 0,
      don_active: [],
      don_rested: [],
      don_attached: [],
      don_deck_count: 10
    };
    
    updatePlayerCounts(playerState);
    return playerState;
  };

  const state: GameState = {
    game_id: `local-${uuidv4()}`,
    room_name: roomName,
    status: 'PLAYING',
    players: {
      p1: setupPlayer(p1Deck, 'p1', 'Player 1'),
      p2: setupPlayer(p2Deck, 'p2', 'Player 2')
    },
    turn_info: { turn_count: 1, active_player_id: 'p1', current_phase: 'MAIN', winner: null }
  };

  state.mulligan_finished = { p1: false, p2: false };

  const p1 = state.players.p1;
  const p1DonDeck = p1.zones.don_deck;
  if (p1DonDeck && p1DonDeck.length > 0) {
    const don = p1DonDeck.shift();
    if (don) {
      don.is_rest = false;
      don.is_face_up = true;
      p1.don_active.push(don);
      updatePlayerCounts(p1);
    }
  }

  logger.log({ level: 'info', action: 'local.init_game', msg: 'Local game state initialized', payload: { gameId: state.game_id } });
  return state;
};

export const moveCardLocal = (state: GameState, cardUuid: string, destPid: 'p1' | 'p2', destZone: string, index: number = -1): GameState => {
  const newState = cloneState(state);
  let targetCard: CardInstance | null = null;
  let sourcePid: 'p1' | 'p2' | null = null;
  let sourceZone: string | null = null;

  for (const pid of ['p1', 'p2'] as const) {
    const p = newState.players[pid];
    if (p.leader?.uuid === cardUuid) { targetCard = p.leader; p.leader = null; sourcePid = pid; sourceZone = 'leader'; break; }
    if (p.stage?.uuid === cardUuid) { targetCard = p.stage; p.stage = null; sourcePid = pid; sourceZone = 'stage'; break; }
    
    for (const [zoneName, zoneArray] of Object.entries(p.zones)) {
      if (!Array.isArray(zoneArray)) continue;
      const idx = zoneArray.findIndex((c: CardInstance) => c.uuid === cardUuid);
      if (idx !== -1) { 
        targetCard = zoneArray.splice(idx, 1)[0]; 
        sourcePid = pid;
        sourceZone = zoneName;
        break; 
      }
    }
    if (targetCard) break;

    const donKeys = ['don_active', 'don_rested', 'don_attached'] as const;
    for (const key of donKeys) {
      const idx = p[key].findIndex((c: CardInstance) => c.uuid === cardUuid);
      if (idx !== -1) { 
        targetCard = p[key].splice(idx, 1)[0]; 
        sourcePid = pid;
        sourceZone = key;
        break; 
      }
    }
    if (targetCard) break;
  }

  if (!targetCard || !sourcePid) return state;

  const isDon = targetCard.type === 'DON' || targetCard.type === 'ドン!!';
  const isLeader = targetCard.type === 'LEADER' || targetCard.type === 'リーダー';

  if (sourcePid !== destPid) {
    logger.warn('local.move_blocked', 'Cannot move card to opponent\'s area');
    return state;
  }

  if (destZone === 'leader') {
    if (!isLeader) { logger.warn('local.move_blocked', 'Only Leader can be placed in Leader zone'); return state; }
  } else if (['don_active', 'don_rested', 'don_deck'].includes(destZone)) {
    if (!isDon) { logger.warn('local.move_blocked', 'Only Don!! can be placed in Don zone'); return state; }
  } else if (['hand', 'deck', 'life', 'trash', 'field', 'stage'].includes(destZone)) {
    if (isDon || isLeader) { 
      logger.warn('local.move_blocked', `Leader/Don cannot be placed in ${destZone}`); 
      return state; 
    }
  }

  if (sourceZone === 'field') {
    const srcPlayer = newState.players[sourcePid];
    const attachedDons = srcPlayer.don_attached.filter((d) => d.attached_to === cardUuid);
    
    for (const don of attachedDons) {
      const donIdx = srcPlayer.don_attached.indexOf(don);
      if (donIdx !== -1) srcPlayer.don_attached.splice(donIdx, 1);
      don.is_rest = true;
      don.attached_to = null;
      srcPlayer.don_rested.push(don);
    }
  }

  targetCard.is_rest = false;
  targetCard.attached_don = 0;
  
  if (['hand', 'field', 'trash', 'don_active', 'don_rested', 'stage'].includes(destZone)) {
    targetCard.is_face_up = true;
  } else if (['deck', 'life', 'don_deck'].includes(destZone)) {
    targetCard.is_face_up = false;
  }

  const destPlayer = newState.players[destPid];

  if (sourceZone === 'hand' && destZone === 'field' && sourcePid === destPid) {
    const cost = targetCard.cost || 0;
    const activeDons = destPlayer.don_active;
    if (cost > 0 && activeDons.length >= cost) {
      for (let i = 0; i < cost; i++) {
        const don = activeDons.shift();
        if (don) {
          don.is_rest = true;
          destPlayer.don_rested.push(don);
        }
      }
      logger.log({ level: 'info', action: 'local.auto_cost', msg: `Paid ${cost} cost`, payload: { card: targetCard.name } });
    }
  }

  if (destZone === 'leader') { destPlayer.leader = targetCard as LeaderCard; }
  else if (destZone === 'stage') {
    if (destPlayer.stage) {
      destPlayer.zones.trash.push(destPlayer.stage);
    }
    destPlayer.stage = targetCard as BoardCard;
  }
  else if (destZone === 'don_active' || destZone === 'don_rested') { destPlayer[destZone].push(targetCard); }
  else {
    const zone = destPlayer.zones[destZone as keyof ZoneState];
    if (Array.isArray(zone)) {
      if (index === -1) zone.push(targetCard);
      else zone.splice(index, 0, targetCard);
    }
  }

  updatePlayerCounts(newState.players[sourcePid]);
  if (sourcePid !== destPid) updatePlayerCounts(newState.players[destPid]);

  logger.log({ level: 'info', action: 'local.move_card', msg: `Moved ${targetCard.name}`, payload: { uuid: cardUuid, to: destZone } });
  return newState;
};

export const attachDonLocal = (state: GameState, donUuid: string, targetUuid: string): GameState => {
  const newState = cloneState(state);
  let donCard: CardInstance | null = null;
  let ownerPid: 'p1' | 'p2' | null = null;

  for (const pid of ['p1', 'p2'] as const) {
    const p = newState.players[pid];
    const activeIdx = p.don_active.findIndex(c => c.uuid === donUuid);
    if (activeIdx !== -1) { donCard = p.don_active.splice(activeIdx, 1)[0]; ownerPid = pid; break; }
    
    const restedIdx = p.don_rested.findIndex(c => c.uuid === donUuid);
    if (restedIdx !== -1) { donCard = p.don_rested.splice(restedIdx, 1)[0]; ownerPid = pid; break; }
    
    const attachedIdx = p.don_attached.findIndex(c => c.uuid === donUuid);
    if (attachedIdx !== -1) { 
      donCard = p.don_attached.splice(attachedIdx, 1)[0]; 
      ownerPid = pid;
      
      const oldTargetUuid = donCard.attached_to;
      if (oldTargetUuid) {
        if (p.leader && p.leader.uuid === oldTargetUuid) { 
          p.leader.attached_don = Math.max(0, (p.leader.attached_don || 0) - 1); 
        } else { 
          const oldTarget = p.zones.field.find(c => c.uuid === oldTargetUuid); 
          if (oldTarget) { 
            oldTarget.attached_don = Math.max(0, (oldTarget.attached_don || 0) - 1); 
          } 
        }
      }
      break; 
    }
  }

  if (!donCard || !ownerPid) return state;

  const player = newState.players[ownerPid];
  let targetFound = false;
  
  if (player.leader && player.leader.uuid === targetUuid) { 
    player.leader.attached_don = (player.leader.attached_don || 0) + 1; 
    targetFound = true; 
  } else { 
    const fieldTarget = player.zones.field.find(c => c.uuid === targetUuid); 
    if (fieldTarget) { 
      fieldTarget.attached_don = (fieldTarget.attached_don || 0) + 1; 
      targetFound = true; 
    } 
  }
  
  if (targetFound) { 
    donCard.is_rest = false; 
    donCard.attached_to = targetUuid; 
    player.don_attached.push(donCard); 
  } else { 
    player.don_active.push(donCard); 
  }

  updatePlayerCounts(player);
  return newState;
};

export const toggleRestLocal = (state: GameState, cardUuid: string): GameState => {
  const newState = cloneState(state);
  for (const pid of ['p1', 'p2'] as const) {
    const p = newState.players[pid];
    if (p.leader?.uuid === cardUuid) { p.leader.is_rest = !p.leader.is_rest; break; }
    if (p.stage?.uuid === cardUuid) { p.stage.is_rest = !p.stage.is_rest; break; }
    
    const fieldIdx = p.zones.field.findIndex(c => c.uuid === cardUuid);
    if (fieldIdx !== -1) { p.zones.field[fieldIdx].is_rest = !p.zones.field[fieldIdx].is_rest; break; }
    
    const activeDonIdx = p.don_active.findIndex(c => c.uuid === cardUuid);
    if (activeDonIdx !== -1) { 
      const card = p.don_active.splice(activeDonIdx, 1)[0]; card.is_rest = true; p.don_rested.push(card); 
      updatePlayerCounts(p); break; 
    }
    const restedDonIdx = p.don_rested.findIndex(c => c.uuid === cardUuid);
    if (restedDonIdx !== -1) { 
      const card = p.don_rested.splice(restedDonIdx, 1)[0]; card.is_rest = false; p.don_active.push(card); 
      updatePlayerCounts(p); break; 
    }
  }
  return newState;
};

export const resolveTurnEndLocal = (state: GameState): GameState => {
  const newState = cloneState(state);
  const nextPid = newState.turn_info.active_player_id === 'p1' ? 'p2' : 'p1';
  newState.turn_info.active_player_id = nextPid;
  newState.turn_info.turn_count += 1;
  const currentTurn = newState.turn_info.turn_count;

  const nextPlayer = newState.players[nextPid];

  if (nextPlayer.leader) { nextPlayer.leader.is_rest = false; nextPlayer.leader.attached_don = 0; }
  if (nextPlayer.stage) { nextPlayer.stage.is_rest = false; }
  nextPlayer.zones.field.forEach(c => { c.is_rest = false; c.attached_don = 0; });

  nextPlayer.don_active.push(...nextPlayer.don_rested);
  nextPlayer.don_rested = [];
  nextPlayer.don_active.push(...nextPlayer.don_attached);
  nextPlayer.don_attached = [];
  nextPlayer.don_active.forEach(d => { d.is_rest = false; d.attached_to = null; });

  if (currentTurn > 1) {
    const deck = nextPlayer.zones.deck || [];
    if (deck.length > 0) {
      const card = deck.shift();
      if (card) { card.is_face_up = true; nextPlayer.zones.hand.push(card); }
      nextPlayer.zones.deck = deck;
    }
  }

  const currentDonCount = nextPlayer.don_active.length;
  const donToAddAmount = currentTurn === 1 ? 1 : 2;
  const donToAdd = Math.min(donToAddAmount, 10 - currentDonCount);
  
  const donDeck = nextPlayer.zones.don_deck || [];
  if (donToAdd > 0 && donDeck.length > 0) {
    for (let i = 0; i < donToAdd; i++) {
      if (donDeck.length > 0) {
        const don = donDeck.shift();
        if (don) { don.is_rest = false; don.is_face_up = true; nextPlayer.don_active.push(don); }
      }
    }
    nextPlayer.zones.don_deck = donDeck;
  }

  updatePlayerCounts(nextPlayer);

  newState.turn_info.current_phase = 'MAIN';
  logger.log({ level: 'info', action: 'local.turn_end', msg: `Turn passed to ${nextPid}`, payload: { turn: currentTurn } });
  return newState;
};

export const mulliganLocal = (state: GameState, playerId: string): GameState => {
  const newState = cloneState(state);
  const player = newState.players[playerId as 'p1' | 'p2'];
  
  if (!player.zones.deck) { player.zones.deck = []; }
  const deck = player.zones.deck;
  
  player.zones.hand.forEach(c => c.is_face_up = false);
  deck.push(...player.zones.hand);
  player.zones.hand = [];
  
  deck.sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < 5; i++) {
    const card = deck.shift();
    if (card) { card.is_face_up = true; player.zones.hand.push(card); }
  }

  logger.log({ level: 'info', action: 'local.mulligan', msg: `Mulligan executed for ${playerId}` });
  return newState;
};

export const finishMulliganLocal = (state: GameState, playerId: string): GameState => {
  const newState = cloneState(state);
  const flags = newState.mulligan_finished || { p1: false, p2: false };
  flags[playerId as 'p1' | 'p2'] = true;
  newState.mulligan_finished = flags;
  return newState;
};

export const drawCardLocal = (state: GameState, playerId: string): GameState => {
  const newState = cloneState(state);
  const player = newState.players[playerId as 'p1' | 'p2'];
  const deck = player.zones.deck || [];
  if (deck.length > 0) { 
    const card = deck.shift(); 
    if (card) { card.is_face_up = true; player.zones.hand.push(card); } 
    player.zones.deck = deck; 
    logger.log({ level: 'info', action: 'local.draw', msg: `${playerId} manually drew a card` }); 
  }
  return newState;
};

export const shuffleDeckLocal = (state: GameState, playerId: string): GameState => {
  const newState = cloneState(state);
  const player = newState.players[playerId as 'p1' | 'p2'];
  if (player.zones.deck) { 
    player.zones.deck.sort(() => Math.random() - 0.5); 
    logger.log({ level: 'info', action: 'local.shuffle', msg: `${playerId} shuffled deck` }); 
  }
  return newState;
};

export const resetGameLocal = (state: GameState): GameState => {
  const newState = cloneState(state);
  newState.turn_info.turn_count = 1;
  newState.turn_info.active_player_id = 'p1';
  newState.mulligan_finished = { p1: false, p2: false };

  for (const pid of ['p1', 'p2'] as const) {
    const p = newState.players[pid];
    
    const allCards: CardInstance[] = [];
    allCards.push(...p.zones.hand); p.zones.hand = [];
    allCards.push(...p.zones.field); p.zones.field = [];
    allCards.push(...p.zones.life); p.zones.life = [];
    allCards.push(...p.zones.trash); p.zones.trash = [];
    if (p.zones.deck) { allCards.push(...p.zones.deck); p.zones.deck = []; }
    if (p.stage) { allCards.push(p.stage); p.stage = null; }

    allCards.forEach(c => {
      c.is_rest = false;
      c.attached_don = 0;
      c.is_face_up = false;
    });

    const allDons: CardInstance[] = [];
    allDons.push(...p.don_active); p.don_active = [];
    allDons.push(...p.don_rested); p.don_rested = [];
    allDons.push(...p.don_attached); p.don_attached = [];
    if (p.zones.don_deck) { allDons.push(...p.zones.don_deck); p.zones.don_deck = []; }
    
    allDons.forEach(d => {
      d.is_rest = false;
      d.is_face_up = false;
      d.attached_to = null;
    });
    p.zones.don_deck = allDons;

    if (p.leader) {
      p.leader.is_rest = false;
      p.leader.attached_don = 0;
    }

    allCards.sort(() => Math.random() - 0.5);
    
    const lifeCount = p.leader?.life || 5;
    p.zones.life = allCards.splice(0, lifeCount);
    p.zones.hand = allCards.splice(0, 5).map(c => ({ ...c, is_face_up: true }));
    p.zones.deck = allCards;
    
    updatePlayerCounts(p);
  }

  const p1 = newState.players.p1;
  const p1DonDeck = p1.zones.don_deck;
  if (p1DonDeck && p1DonDeck.length > 0) {
    const don = p1DonDeck.shift();
    if (don) {
      don.is_rest = false;
      don.is_face_up = true;
      p1.don_active.push(don);
      updatePlayerCounts(p1);
    }
  }

  logger.log({ level: 'info', action: 'local.reset', msg: 'Game reset executed locally' });
  return newState;
};
