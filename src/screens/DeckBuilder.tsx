import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../api/api.config';

// --- 型定義 ---
interface CardData {
  uuid: string;
  name: string;
  type: string;
  color: string[];
  cost?: number;
  power?: number;
  counter?: number;
  attributes?: string[];
  text?: string;
}

interface DeckData {
  id?: string; // 保存済みデッキにはIDがある
  name: string;
  leader_id: string | null;
  card_uuids: string[];
  don_uuids: string[];
}

// --- 1画面目: デッキ一覧 ---
const DeckListView = ({ 
  onSelectDeck, 
  onCreateNew, 
  onBack 
}: { 
  onSelectDeck: (deck: DeckData) => void, 
  onCreateNew: () => void,
  onBack: () => void 
}) => {
  const [decks, setDecks] = useState<DeckData[]>([]);

  useEffect(() => {
    // デッキ一覧を取得
    const fetchDecks = async () => {
      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const data = await res.json();
        if (data.success && Array.isArray(data.decks)) {
          setDecks(data.decks);
        }
      } catch (e) {
        logger.log({ level: 'error', action: 'deck_list.fetch', msg: String(e) });
      }
    };
    fetchDecks();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#222', color: '#eee', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <div style={{ padding: '15px', background: '#333', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ padding: '8px 16px', cursor: 'pointer', background: '#555', color: 'white', border: 'none', borderRadius: '4px' }}>
          ← TOPへ
        </button>
        <h2 style={{ margin: 0, fontSize: '18px' }}>デッキ一覧</h2>
        <button onClick={onCreateNew} style={{ padding: '8px 16px', cursor: 'pointer', background: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          ＋ 新規作成
        </button>
      </div>

      {/* リストエリア (縦スクロール) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {decks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>保存されたデッキはありません</div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {decks.map((deck, idx) => (
                    <div 
                        key={deck.id || idx} 
                        onClick={() => onSelectDeck(deck)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: '#333',
                            border: '1px solid #444',
                            borderRadius: '8px',
                            padding: '10px',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#444'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
                    >
                        {/* 左端: リーダー (アイコン風表示) */}
                        <div style={{ 
                            width: '50px', 
                            height: '70px', 
                            background: '#222', 
                            border: '1px solid #555', 
                            borderRadius: '4px',
                            marginRight: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            textAlign: 'center',
                            overflow: 'hidden',
                            color: '#aaa',
                            flexShrink: 0
                        }}>
                            {deck.leader_id ? deck.leader_id : "No Leader"}
                        </div>

                        {/* 右側: デッキ情報 */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{deck.name}</div>
                            <div style={{ fontSize: '12px', color: '#888' }}>
                                Leader: {deck.leader_id || "-"} / Cards: {deck.card_uuids?.length || 0}枚
                            </div>
                        </div>

                        <div style={{ fontSize: '20px', color: '#555', paddingRight: '10px' }}>›</div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};


// --- 2画面目: デッキ編集 (以前のDeckBuilderの中身) ---
const DeckEditor = ({ 
  initialDeck, 
  onBack 
}: { 
  initialDeck: DeckData, 
  onBack: () => void 
}) => {
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [deck, setDeck] = useState<DeckData>(initialDeck);
  const [filterColor, setFilterColor] = useState<string>('ALL');

  useEffect(() => {
    fetchCards();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [allCards, filterColor]);

  const fetchCards = async () => {
    try {
      const url = `${API_CONFIG.BASE_URL}/api/cards`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.cards)) {
        setAllCards(data.cards);
      }
    } catch (e) {
      logger.log({ level: 'error', action: 'deck.fetch_cards', msg: String(e) });
    }
  };

  const applyFilter = () => {
    let res = allCards;
    if (filterColor !== 'ALL') {
      res = res.filter(c => c.color && c.color.includes(filterColor));
    }
    setFilteredCards(res);
  };

  const addToDeck = (card: CardData) => {
    if (card.type === 'LEADER') {
      setDeck(prev => ({ ...prev, leader_id: card.uuid }));
    } else {
      if (deck.card_uuids.length >= 50) return;
      setDeck(prev => ({ ...prev, card_uuids: [...prev.card_uuids, card.uuid] }));
    }
  };

  const removeFromDeck = (index: number) => {
    setDeck(prev => {
      const newIds = [...prev.card_uuids];
      newIds.splice(index, 1);
      return { ...prev, card_uuids: newIds };
    });
  };

  const saveDeck = async () => {
    if (!deck.leader_id) {
        alert("リーダーカードを選択してください。");
        return;
    }
    try {
        const url = `${API_CONFIG.BASE_URL}/api/deck`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deck)
        });
        const json = await res.json();
        if (json.success) {
            alert(`デッキ「${deck.name}」を保存しました！`);
        } else {
            alert('保存失敗: ' + json.error);
        }
    } catch(e) {
        alert("保存中にエラーが発生しました。");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', color: '#eee', background: '#222', fontFamily: 'sans-serif' }}>
      {/* 左エリア: カードリスト */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #444' }}>
        <div style={{ padding: '10px', background: '#333', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={onBack} style={{ padding: '5px 15px', cursor: 'pointer' }}>← 一覧へ</button>
            <select onChange={e => setFilterColor(e.target.value)} style={{ padding: '5px' }} value={filterColor}>
                <option value="ALL">全色</option>
                <option value="Red">赤</option>
                <option value="Green">緑</option>
                <option value="Blue">青</option>
                <option value="Purple">紫</option>
                <option value="Black">黒</option>
                <option value="Yellow">黄</option>
            </select>
            <span>Hit: {filteredCards.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start' }}>
            {filteredCards.map((c) => (
                <div key={c.uuid} onClick={() => addToDeck(c)} style={{ width: '90px', height: '126px', background: '#444', border: '1px solid #666', borderRadius: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '11px', textAlign: 'center', padding: '2px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: c.type === 'LEADER' ? '#e74c3c' : (c.type === 'EVENT' ? '#f39c12' : '#3498db') }} />
                    <strong style={{ display: 'block', marginBottom: '4px' }}>{c.name}</strong>
                    <div style={{ fontSize: '9px', color: '#aaa' }}>{c.uuid}</div>
                    {c.cost !== undefined && <div style={{ marginTop: '2px', background: '#222', padding: '0 4px', borderRadius: '4px' }}>C: {c.cost}</div>}
                </div>
            ))}
        </div>
      </div>

      {/* 右エリア: デッキ編集 */}
      <div style={{ width: '300px', padding: '10px', background: '#2a2a2a', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px' }}>デッキ編集</h3>
        <input value={deck.name} onChange={e => setDeck(prev => ({...prev, name: e.target.value}))} placeholder="デッキ名" style={{ marginBottom: '15px', padding: '8px', width: '100%' }} />
        <div style={{ marginBottom: '15px', padding: '10px', background: '#333', border: '1px solid #555' }}>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Leader</div>
            <div style={{ fontWeight: 'bold' }}>{deck.leader_id || "(未選択)"}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #444', background: '#222', marginBottom: '10px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {deck.card_uuids.map((id, idx) => (
                    <li key={idx} style={{ padding: '6px 10px', borderBottom: '1px solid #333', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{idx + 1}. {id}</span>
                        <button onClick={() => removeFromDeck(idx)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>×</button>
                    </li>
                ))}
            </ul>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>枚数:</span>
            <span style={{ color: deck.card_uuids.length === 50 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>{deck.card_uuids.length} / 50</span>
        </div>
        <button onClick={saveDeck} style={{ padding: '12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>保存する</button>
      </div>
    </div>
  );
};

// --- 親コンポーネント: 状態遷移管理 ---
export const DeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [selectedDeck, setSelectedDeck] = useState<DeckData | null>(null);

  const handleCreateNew = () => {
    setSelectedDeck({
      name: 'New Deck',
      leader_id: null,
      card_uuids: [],
      don_uuids: []
    });
    setMode('edit');
  };

  const handleSelectDeck = (deck: DeckData) => {
    setSelectedDeck(deck);
    setMode('edit');
  };

  if (mode === 'list') {
    return (
      <DeckListView 
        onSelectDeck={handleSelectDeck} 
        onCreateNew={handleCreateNew} 
        onBack={onBack} 
      />
    );
  } else {
    return (
      <DeckEditor 
        initialDeck={selectedDeck!} 
        onBack={() => setMode('list')} 
      />
    );
  }
};
