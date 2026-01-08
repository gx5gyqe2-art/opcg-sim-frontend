import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../api/api.config'; // 追加: 設定ファイルのインポート

// カード情報の簡易的な型定義
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

// 保存するデッキデータの型
interface DeckData {
  name: string;
  leader_id: string | null;
  card_uuids: string[];
  don_uuids: string[];
}

export const DeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  
  // デッキ状態
  const [deck, setDeck] = useState<DeckData>({
    name: 'New Deck',
    leader_id: null,
    card_uuids: [],
    don_uuids: []
  });
  
  // フィルター用
  const [filterColor, setFilterColor] = useState<string>('ALL');

  // 起動時にカード情報をAPIから取得
  useEffect(() => {
    fetchCards();
  }, []);

  // フィルター条件が変わったら表示を更新
  useEffect(() => {
    applyFilter();
  }, [allCards, filterColor]);

  const fetchCards = async () => {
    try {
      // 修正: API_CONFIGのBASE_URLを使用
      const url = `${API_CONFIG.BASE_URL}/api/cards`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.cards)) {
        setAllCards(data.cards);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (e) {
      logger.log({ level: 'error', action: 'deck.fetch_cards', msg: String(e) });
      alert("カード情報の取得に失敗しました。");
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
        // 修正: API_CONFIGのBASE_URLを使用
        const url = `${API_CONFIG.BASE_URL}/api/deck`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deck)
        });
        const json = await res.json();
        if (json.success) {
            alert(`デッキ「${deck.name}」を保存しました！`);
            logger.log({ level: 'info', action: 'deck.save_success', msg: `Deck saved: ${deck.name}` });
        } else {
            alert('保存失敗: ' + json.error);
        }
    } catch(e) {
        logger.log({ level: 'error', action: 'deck.save_error', msg: String(e) });
        alert("保存中にエラーが発生しました。");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', color: '#eee', background: '#222', fontFamily: 'sans-serif' }}>
      
      {/* --- 左エリア: カードリスト --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #444' }}>
        <div style={{ padding: '10px', background: '#333', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={onBack} style={{ padding: '5px 15px', cursor: 'pointer' }}>← 戻る</button>
            <select 
                onChange={e => setFilterColor(e.target.value)} 
                style={{ padding: '5px', borderRadius: '4px' }}
                value={filterColor}
            >
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
                <div 
                    key={c.uuid} 
                    onClick={() => addToDeck(c)} 
                    style={{ 
                        width: '90px', 
                        height: '126px', 
                        background: '#444', 
                        border: '1px solid #666', 
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '11px', 
                        textAlign: 'center',
                        padding: '2px',
                        position: 'relative'
                    }}
                    title={`${c.name}\nCost: ${c.cost ?? '-'}\nPower: ${c.power ?? '-'}`}
                >
                    <div style={{ 
                        position: 'absolute', top: 0, left: 0, right: 0, height: '4px', 
                        background: c.type === 'LEADER' ? '#e74c3c' : (c.type === 'EVENT' ? '#f39c12' : '#3498db') 
                    }} />
                    
                    <strong style={{ display: 'block', marginBottom: '4px' }}>{c.name}</strong>
                    <div style={{ fontSize: '9px', color: '#aaa' }}>{c.uuid}</div>
                    {c.cost !== undefined && <div style={{ marginTop: '2px', background: '#222', padding: '0 4px', borderRadius: '4px' }}>C: {c.cost}</div>}
                </div>
            ))}
        </div>
      </div>

      {/* --- 右エリア: 作成中のデッキ --- */}
      <div style={{ width: '300px', padding: '10px', background: '#2a2a2a', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px' }}>デッキ編集</h3>
        
        <input 
            value={deck.name} 
            onChange={e => setDeck(prev => ({...prev, name: e.target.value}))}
            placeholder="デッキ名を入力"
            style={{ marginBottom: '15px', padding: '8px', width: '100%', boxSizing: 'border-box' }}
        />
        
        <div style={{ marginBottom: '15px', padding: '10px', background: '#333', border: '1px solid #555', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Leader</div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: deck.leader_id ? '#fff' : '#666' }}>
                {deck.leader_id || "(未選択)"}
            </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #444', background: '#222', marginBottom: '10px', borderRadius: '4px' }}>
            {deck.card_uuids.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#555' }}>カードがありません</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {deck.card_uuids.map((id, idx) => (
                    <li key={idx} style={{ 
                        padding: '6px 10px', 
                        borderBottom: '1px solid #333', 
                        fontSize: '13px', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{idx + 1}. {id}</span>
                        <button 
                            onClick={() => removeFromDeck(idx)}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#e74c3c', 
                                cursor: 'pointer', 
                                fontWeight: 'bold' 
                            }}
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
            <span>枚数:</span>
            <span style={{ color: deck.card_uuids.length === 50 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                {deck.card_uuids.length} / 50
            </span>
        </div>

        <button 
            onClick={saveDeck} 
            style={{ 
                padding: '12px', 
                background: '#e74c3c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                fontSize: '16px'
            }}
        >
            保存する
        </button>
      </div>
    </div>
  );
};
