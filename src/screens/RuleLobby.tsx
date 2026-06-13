import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../api/api.config';
import { apiClient } from '../api/client';
import { logger } from '../utils/logger';
import '../ui/GameUI.css';

interface RuleRoomInfo {
  game_id: string;
  room_name: string;
  p1_name: string;
  p2_name: string;
  turn: number;
  created_at: string;
  active_connections: number;
  status: string;
  ready_states?: { p1: boolean; p2: boolean };
}

interface RuleLobbyProps {
  onBack: () => void;
  onJoin: (gameId: string, role: 'p1' | 'p2', roomName?: string) => void;
  onCreate: (gameId: string) => void;
}

// ルールモード・オンライン対戦のロビー（ルーム一覧）。
// フリーモードの RoomLobby と分離した専用ロビーで、/api/rule/* を利用する。
export const RuleLobby: React.FC<RuleLobbyProps> = ({ onBack, onJoin, onCreate }) => {
  const [rooms, setRooms] = useState<RuleRoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const lastHostedGameId = localStorage.getItem('opcg_rule_host_game');

  const handleCreate = async () => {
    if (!newRoomName.trim() || creating) return;
    setCreating(true);
    try {
      const { game_id } = await apiClient.createRuleRoom(newRoomName.trim());
      if (game_id) onCreate(game_id);
    } catch (e) {
      logger.error('rule_lobby.create_fail', String(e));
      alert('ルームの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/rule/list`);
      const data = await res.json();
      if (data.success) setRooms(data.games);
    } catch (e) {
      logger.error('rule_lobby.fetch_fail', String(e));
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
    <div style={{ height: '100vh', width: '100vw', background: 'radial-gradient(circle at center, #3a2020 0%, #000000 100%)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <button onClick={onBack} style={{ padding: '8px 16px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← 戻る</button>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#e74c3c' }}>RULE LOBBY</h2>
        <button onClick={fetchRooms} style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' }}>更新</button>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid #333', background: 'rgba(0,0,0,0.3)', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          placeholder="部屋名を入力..."
          style={{ flex: 1, padding: '8px 12px', background: '#1a1a2e', border: '1px solid #555', borderRadius: '4px', color: '#fff', fontSize: '14px', outline: 'none' }}
        />
        <button
          onClick={handleCreate}
          disabled={!newRoomName.trim() || creating}
          style={{ padding: '8px 20px', background: (newRoomName.trim() && !creating) ? '#e74c3c' : '#444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: (newRoomName.trim() && !creating) ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
        >
          {creating ? '作成中...' : '＋ ルームを作成'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading rooms...</div>
        ) : rooms.filter(r => r.status === 'WAITING').length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
            <p>現在、対戦募集中のルームはありません。</p>
            <p style={{ fontSize: '12px' }}>上のフォームから新しく作成してください。</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {rooms.filter(r => r.status === 'WAITING').map(room => {
              const isMyRoom = room.game_id === lastHostedGameId;
              const isFull = !isMyRoom && room.active_connections >= 2;
              const role: 'p1' | 'p2' = isMyRoom ? 'p1' : (room.active_connections === 0 ? 'p1' : 'p2');
              return (
                <div
                  key={room.game_id}
                  onClick={() => { if (!isFull) onJoin(room.game_id, role, room.room_name); }}
                  style={{ background: isMyRoom ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isMyRoom ? '#e74c3c' : '#555'}`, borderRadius: '12px', padding: '20px', cursor: isFull ? 'not-allowed' : 'pointer', transition: 'transform 0.2s', position: 'relative', opacity: isFull ? 0.6 : 1 }}
                  onMouseOver={(e) => { if (!isFull) e.currentTarget.style.background = isMyRoom ? 'rgba(231,76,60,0.25)' : 'rgba(255,255,255,0.1)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = isMyRoom ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>{room.room_name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>接続: {room.active_connections}/2 | Created: {formatTime(room.created_at)}</div>
                  {isFull ? (
                    <div style={{ position: 'absolute', bottom: '20px', right: '20px', padding: '4px 12px', background: '#7f8c8d', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>FULL</div>
                  ) : isMyRoom ? (
                    <div style={{ position: 'absolute', bottom: '20px', right: '20px', padding: '4px 12px', background: '#e74c3c', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>再入室</div>
                  ) : (
                    <div style={{ position: 'absolute', bottom: '20px', right: '20px', padding: '4px 12px', background: '#3498db', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>JOIN</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: '10px', textAlign: 'center', fontSize: '10px', color: '#666', background: 'rgba(0,0,0,0.3)' }}>
        OPCG Simulator - Rule Mode Online Lobby
      </div>
    </div>
  );
};
