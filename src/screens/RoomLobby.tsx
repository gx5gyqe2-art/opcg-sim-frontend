import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../api/api.config';
import { logger } from '../utils/logger';
import '../ui/GameUI.css';

interface RoomInfo {
  game_id: string;
  room_name: string;
  p1_name: string;
  p2_name: string;
  turn: number;
  created_at: string;
}

interface RoomLobbyProps {
  onBack: () => void;
  onJoin: (gameId: string) => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({ onBack, onJoin }) => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/sandbox/list`);
      const data = await res.json();
      if (data.success) {
        setRooms(data.games);
      }
    } catch (e) {
      logger.error('lobby.fetch_fail', String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => {
    if (!iso || iso === 'N/A') return '';
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return iso; }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', background: 'radial-gradient(circle at center, #2c3e50 0%, #000000 100%)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <button onClick={onBack} style={{ padding: '8px 16px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← 戻る</button>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#d4af37' }}>ROOM LOBBY</h2>
        <button onClick={fetchRooms} style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' }}>更新</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
            <p>現在、アクティブなルームはありません。</p>
            <p style={{ fontSize: '12px' }}>タイトル画面から新しく作成してください。</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {rooms.map(room => (
              <div 
                key={room.game_id} 
                onClick={() => onJoin(room.game_id)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #555', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <div style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>{room.room_name}</div>
                <div style={{ fontSize: '14px', color: '#ccc' }}>Host: {room.p1_name}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>Turn: {room.turn} | Created: {formatTime(room.created_at)}</div>
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', padding: '4px 12px', background: '#3498db', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>JOIN</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '10px', textAlign: 'center', fontSize: '10px', color: '#666', background: 'rgba(0,0,0,0.3)' }}>
        OPCG Simulator - Multi-player Sandbox Lobby
      </div>
    </div>
  );
};
