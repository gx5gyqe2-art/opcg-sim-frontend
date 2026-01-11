import React, { useState, useEffect, useMemo } from 'react';
import { API_CONFIG } from '../api/api.config';
import './GameUI.css'; 

interface DeckOption {
  id: string;
  name: string;
}

interface RoomInfo {
  game_id: string;
  p1_name: string;
  p2_name: string;
  turn: number;
  created_at: string;
}

interface GameStartProps {
  onStart: (
    p1: string, 
    p2: string, 
    mode?: 'normal' | 'sandbox', 
    sandboxOptions?: { role: 'both' | 'p1' | 'p2', gameId?: string }
  ) => void;
  onDeckBuilder: () => void;
}

const GameStart: React.FC<GameStartProps> = ({ onStart, onDeckBuilder }) => {
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [p1Deck, setP1Deck] = useState('imu.json');
  const [p2Deck, setP2Deck] = useState('nami.json');
  const [manualGameId, setManualGameId] = useState('');
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        
        const defaults = [
          { id: 'imu.json', name: 'Imu (Default)' },
          { id: 'nami.json', name: 'Nami (Default)' }
        ];

        let loadedDecks: DeckOption[] = [];
        if (data.success && Array.isArray(data.decks)) {
          loadedDecks = data.decks.map((d: any) => ({
            id: `db:${d.id}`,
            name: d.name
          }));
        }
        
        setDeckOptions([...defaults, ...loadedDecks]);
      } catch (e) {
        console.error("Failed to load decks", e);
        setDeckOptions([
          { id: 'imu.json', name: 'Imu (Default)' },
          { id: 'nami.json', name: 'Nami (Default)' }
        ]);
      }
    };
    fetchDecks();
  }, []);

  // ルーム一覧取得関数
  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/sandbox/list`);
      const data = await res.json();
      if (data.success) {
        setRooms(data.games);
      }
    } catch (e) {
      console.error("Failed to load rooms", e);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  // 時刻フォーマット関数
  const formatTime = (iso: string) => {
      if (!iso || iso === 'N/A') return '';
      try {
          const d = new Date(iso);
          return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      } catch { return iso; }
  };

  const styles = useMemo(() => ({
    container: {
      minHeight: '100vh',
      width: '100%', 
      background: 'radial-gradient(circle at center, #3e2723 0%, #1a0b0b 100%)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f0e6d2',
      fontFamily: '"Times New Roman", "YuMincho", "Hiragino Mincho ProN", serif',
      position: 'relative' as const,
      overflowX: 'hidden' as const,
      padding: isMobile ? '20px' : '0',
      boxSizing: 'border-box' as const
    },
    bgOverlay: {
      position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 2px, transparent 2px, transparent 20px)',
      pointerEvents: 'none' as const,
      zIndex: 0
    },
    title: {
      fontSize: isMobile ? 'clamp(32px, 10vw, 50px)' : 'clamp(40px, 8vw, 80px)',
      fontWeight: '900',
      marginBottom: isMobile ? '20px' : '40px',
      background: 'linear-gradient(to bottom, #ffd700, #b8860b, #8b4513)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 4px 0px rgba(0,0,0,0.8))',
      letterSpacing: isMobile ? '2px' : '6px',
      zIndex: 1,
      textTransform: 'uppercase' as const,
      textAlign: 'center' as const,
      maxWidth: '100%'
    },
    panel: {
      background: '#f4e4bc',
      border: '6px solid #5d4037',
      boxShadow: '0 10px 40px rgba(0,0,0,0.7), inset 0 0 30px rgba(139, 69, 19, 0.2)',
      borderRadius: '8px',
      padding: isMobile ? '20px' : '40px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: isMobile ? '20px' : '30px',
      width: '100%',
      maxWidth: '600px',
      zIndex: 1,
      position: 'relative' as const,
      color: '#3e2723',
      boxSizing: 'border-box' as const
    },
    rivet: (top: boolean, left: boolean) => ({
      position: 'absolute' as const,
      width: isMobile ? '8px' : '12px',
      height: isMobile ? '8px' : '12px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffd700, #8b4513)',
      boxShadow: '1px 1px 2px rgba(0,0,0,0.5)',
      top: top ? '10px' : 'auto',
      bottom: !top ? '10px' : 'auto',
      left: left ? '10px' : 'auto',
      right: !left ? '10px' : 'auto'
    }),
    selectGroup: {
      display: 'flex', flexDirection: 'column' as const, gap: '8px'
    },
    label: {
      fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', color: '#5d4037',
      textTransform: 'uppercase' as const, letterSpacing: '1px'
    },
    select: {
      width: '100%', padding: '12px',
      background: '#fff8e1',
      color: '#3e2723',
      border: '2px solid #8b4513',
      borderRadius: '4px',
      fontSize: isMobile ? '16px' : '18px',
      fontFamily: 'inherit',
      fontWeight: 'bold',
      outline: 'none',
      cursor: 'pointer',
      boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.1)',
      boxSizing: 'border-box' as const
    },
    vs: {
      textAlign: 'center' as const,
      fontSize: isMobile ? '24px' : '36px',
      fontWeight: 'bold',
      color: '#8b0000',
      textShadow: '0 2px 0 rgba(0,0,0,0.2)',
      margin: isMobile ? '-5px 0' : '-10px 0',
      fontStyle: 'italic'
    },
    actions: {
      display: 'flex', 
      flexDirection: 'column' as const,
      gap: '15px', 
      marginTop: isMobile ? '20px' : '30px', 
      zIndex: 1, 
      alignItems: 'center',
      width: isMobile ? '100%' : 'auto',
      maxWidth: '600px',
      boxSizing: 'border-box' as const
    },
    subBtn: {
      background: 'transparent',
      border: '2px solid #d4af37',
      color: '#d4af37',
      padding: '12px 30px',
      fontSize: '16px',
      fontWeight: 'bold',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textShadow: '0 1px 2px black',
      width: isMobile ? '100%' : 'auto',
      boxSizing: 'border-box' as const
    },
    mainBtn: {
      background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
      border: '2px solid #ffeba7',
      padding: '18px 60px',
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: 'bold',
      color: '#fff',
      borderRadius: '4px',
      cursor: 'pointer',
      boxShadow: '0 5px 15px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
      textShadow: '0 2px 0 #3e2723',
      fontFamily: 'inherit',
      letterSpacing: '2px',
      width: isMobile ? '100%' : 'auto',
      boxSizing: 'border-box' as const
    },
    roomList: {
      width: '100%',
      maxHeight: '150px',
      overflowY: 'auto' as const,
      background: '#222',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '5px'
    },
    roomItem: {
      padding: '8px',
      borderBottom: '1px solid #444',
      cursor: 'pointer',
      color: '#ddd',
      fontSize: '14px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }), [isMobile]);

  return (
    <div style={styles.container}>
      <div style={styles.bgOverlay}></div>
      <div style={styles.title}>OPCG SIM</div>
      <div style={styles.panel}>
        <div style={styles.rivet(true, true)}></div>
        <div style={styles.rivet(true, false)}></div>
        <div style={styles.rivet(false, true)}></div>
        <div style={styles.rivet(false, false)}></div>

        <div style={styles.selectGroup}>
          <label style={styles.label}>Player 1 (Host)</label>
          <select value={p1Deck} onChange={(e) => setP1Deck(e.target.value)} style={styles.select}>
            {deckOptions.map(opt => <option key={`p1-${opt.id}`} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>

        <div style={styles.vs}>VS</div>

        <div style={styles.selectGroup}>
          <label style={styles.label}>Player 2 (Opponent)</label>
          <select value={p2Deck} onChange={(e) => setP2Deck(e.target.value)} style={styles.select}>
            {deckOptions.map(opt => <option key={`p2-${opt.id}`} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.actions}>
        
        {/* メインのゲーム開始ボタン */}
        <button 
          onClick={() => onStart(p1Deck, p2Deck, 'normal')}
          style={styles.mainBtn}
          className="hover-scale"
        >
          VS CPU / Rule Enforced
        </button>

        <div style={{ width: '100%', height: 1, background: 'rgba(212, 175, 55, 0.3)', margin: '10px 0' }} />

        {/* サンドボックス（ソロ） */}
        <div style={{ display: 'flex', width: '100%', gap: 10 }}>
           <button 
             onClick={() => onStart(p1Deck, p2Deck, 'sandbox', { role: 'both' })}
             style={{ ...styles.subBtn, flex: 1, borderColor: '#2ecc71', color: '#2ecc71' }}
             className="hover-scale"
           >
             1人回し (Solo)
           </button>
           <button 
             onClick={onDeckBuilder}
             style={{ ...styles.subBtn, flex: 1 }}
             className="hover-scale"
           >
             デッキ作成
           </button>
        </div>

        {/* オンライン対戦用エリア */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>ONLINE BATTLE</div>
            
            <button 
              onClick={() => onStart(p1Deck, p2Deck, 'sandbox', { role: 'p1' })}
              style={{ ...styles.subBtn, width: '100%', borderColor: '#3498db', color: '#3498db', fontSize: '14px' }}
              className="hover-scale"
            >
              新規ルーム作成 (Host P1)
            </button>

            {/* ルームリスト */}
            <div style={styles.roomList}>
                {rooms.length === 0 ? (
                    <div style={{ padding: 10, color: '#666', textAlign: 'center' }}>ルームがありません</div>
                ) : (
                    rooms.map(room => (
                        <div 
                            key={room.game_id} 
                            style={styles.roomItem}
                            onClick={() => onStart(p1Deck, p2Deck, 'sandbox', { role: 'p2', gameId: room.game_id })}
                            className="room-item-hover"
                        >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>Host: {room.p1_name} (Turn: {room.turn})</span>
                                <span style={{ fontSize: '10px', color: '#888' }}>{formatTime(room.created_at)}</span>
                            </div>
                            <span style={{ fontSize: '10px', background: '#3498db', padding: '2px 6px', borderRadius: 4, color: 'white' }}>JOIN</span>
                        </div>
                    ))
                )}
            </div>
            
            {/* ID手入力 */}
            <div style={{ display: 'flex', gap: 5 }}>
                <input 
                  type="text" 
                  placeholder="Manual Game ID"
                  value={manualGameId}
                  onChange={(e) => setManualGameId(e.target.value)}
                  style={{ flex: 1, padding: '5px', borderRadius: 4, border: '1px solid #555', background: '#222', color: '#fff' }}
                />
                <button
                  onClick={() => {
                      if(!manualGameId) return alert("IDを入力してください");
                      onStart(p1Deck, p2Deck, 'sandbox', { role: 'p2', gameId: manualGameId });
                  }}
                  style={{ ...styles.subBtn, padding: '5px 10px', fontSize: '12px', minWidth: 'fit-content' }}
                >
                  ID参加
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default GameStart;
