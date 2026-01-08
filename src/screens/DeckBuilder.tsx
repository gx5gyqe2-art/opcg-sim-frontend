import { useState, useEffect, useMemo } from 'react';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../api/api.config';

// --- 型定義 ---
interface CardData {
  uuid: string;
  name: string;
  type: string; // 'LEADER', 'CHARACTER', 'EVENT', 'STAGE'
  color: string[];
  cost?: number;
  power?: number;
  counter?: number;
  attributes?: string[];
  text?: string;
}

interface DeckData {
  id?: string;
  name: string;
  leader_id: string | null;
  card_uuids: string[];
  don_uuids: string[];
}

// 共通スタイル: カード（ダミー画像）
const CardImageStub = ({ text, count, onClick }: { text: string, count?: number, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    style={{
      width: '80px',
      height: '112px',
      background: '#888',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '10px',
      textAlign: 'center',
      position: 'relative',
      borderRadius: '4px',
      border: '1px solid #aaa',
      cursor: onClick ? 'pointer' : 'default',
      boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
    }}
  >
    <span style={{ padding: '5px' }}>{text || "No DATA"}</span>
    
    {count !== undefined && (
      <div style={{
        position: 'absolute',
        top: '-5px',
        right: '-5px',
        background: '#e74c3c',
        color: 'white',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '1px solid white'
      }}>
        {count}
      </div>
    )}
  </div>
);


// --- 1. デッキ一覧画面 ---
const DeckListView = ({ 
  decks, 
  onSelectDeck, 
  onCreateNew, 
  onBack 
}: { 
  decks: DeckData[],
  onSelectDeck: (deck: DeckData) => void, 
  onCreateNew: () => void,
  onBack: () => void 
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#222', color: '#eee' }}>
      <div style={{ padding: '15px', background: '#333', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ padding: '8px 16px', cursor: 'pointer', background: '#555', color: 'white', border: 'none', borderRadius: '4px' }}>← TOP</button>
        <h2 style={{ margin: 0, fontSize: '18px' }}>デッキ一覧</h2>
        <button onClick={onCreateNew} style={{ padding: '8px 16px', cursor: 'pointer', background: '#e67e22', color: 'white', border: 'none', borderRadius: '4px' }}>＋ 新規</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {decks.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>デッキがありません</div>}
        {decks.map((deck, idx) => (
            <div key={deck.id || idx} onClick={() => onSelectDeck(deck)} style={{ display: 'flex', alignItems: 'center', background: '#333', border: '1px solid #444', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}>
                <div style={{ width: '50px', height: '70px', background: '#222', border: '1px solid #555', borderRadius: '4px', marginRight: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#aaa' }}>
                    {deck.leader_id || "L"}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{deck.name}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{deck.card_uuids.length}枚</div>
                </div>
                <div style={{ fontSize: '20px', color: '#555' }}>›</div>
            </div>
        ))}
      </div>
    </div>
  );
};


// --- 2. デッキ編集画面 ---
const DeckEditorView = ({
  deck,
  allCards,
  onUpdateDeck,
  onSave,
  onBack,
  onOpenDetail,
  onOpenCatalog
}: {
  deck: DeckData,
  allCards: CardData[],
  onUpdateDeck: (d: DeckData) => void,
  onSave: () => void,
  onBack: () => void,
  onOpenDetail: (card: CardData) => void,
  onOpenCatalog: (mode: 'leader' | 'main') => void
}) => {
  
  const groupedCards = useMemo(() => {
    const map = new Map<string, number>();
    deck.card_uuids.forEach(uuid => {
      map.set(uuid, (map.get(uuid) || 0) + 1);
    });
    
    const leaderCard = allCards.find(c => c.uuid === deck.leader_id);

    const list: { card: CardData, count: number }[] = [];
    map.forEach((count, uuid) => {
      const card = allCards.find(c => c.uuid === uuid);
      if (card) list.push({ card, count });
    });
    
    // コスト順ソート
    list.sort((a, b) => (a.card.cost || 0) - (b.card.cost || 0));

    return { leaderCard, list };
  }, [deck.card_uuids, deck.leader_id, allCards]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#222', color: '#eee' }}>
      <div style={{ padding: '10px', background: '#333', borderBottom: '1px solid #444', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '10px', alignItems: 'center' }}>
        <button onClick={onBack} style={{ padding: '5px 10px', cursor: 'pointer' }}>←</button>
        <input 
          value={deck.name} 
          onChange={e => onUpdateDeck({...deck, name: e.target.value})}
          style={{ background: '#222', color: 'white', border: '1px solid #555', padding: '5px', borderRadius: '4px' }}
        />
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{deck.card_uuids.length}/50</div>
        <button onClick={onSave} style={{ padding: '5px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存</button>
      </div>

      <div style={{ padding: '10px', background: '#2a2a2a', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>LEADER</div>
          <CardImageStub 
            text={groupedCards.leaderCard?.name || "Select Leader"} 
            onClick={() => onOpenCatalog('leader')} // リーダー選択モードで開く
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', justifyItems: 'center' }}>
          
          <div 
            onClick={() => onOpenCatalog('main')} // メインデッキ選択モードで開く
            style={{
              width: '80px', height: '112px',
              border: '2px dashed #666', borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', cursor: 'pointer', fontSize: '24px'
            }}
          >
            ＋
          </div>

          {groupedCards.list.map((item) => (
            <CardImageStub 
              key={item.card.uuid}
              text={item.card.name} 
              count={item.count} 
              onClick={() => onOpenDetail(item.card)} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};


// --- 3. カード詳細・枚数編集画面 ---
const CardDetailScreen = ({
  card,
  currentCount,
  onCountChange,
  onClose
}: {
  card: CardData,
  currentCount: number,
  onCountChange: (diff: number) => void,
  onClose: () => void
}) => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div style={{ width: '240px', height: '336px', background: '#444', border: '2px solid #fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', color: 'white', flexDirection: 'column' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{card.name}</div>
        <div style={{ marginTop: '10px', color: '#aaa' }}>{card.uuid}</div>
        <div style={{ marginTop: '5px' }}>Power: {card.power || '-'}</div>
        <div style={{ marginTop: '5px' }}>Cost: {card.cost || '-'}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <button 
          onClick={() => onCountChange(-1)}
          disabled={currentCount <= 0}
          style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: currentCount > 0 ? '#e74c3c' : '#555', color: 'white', fontSize: '24px', cursor: 'pointer' }}
        >
          －
        </button>
        
        <div style={{ fontSize: '48px', fontWeight: 'bold', color: 'white', width: '80px', textAlign: 'center' }}>
          {currentCount}
        </div>
        
        <button 
          onClick={() => onCountChange(1)}
          disabled={currentCount >= 4}
          style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: currentCount < 4 ? '#3498db' : '#555', color: 'white', fontSize: '24px', cursor: 'pointer' }}
        >
          ＋
        </button>
      </div>

      <button onClick={onClose} style={{ padding: '15px 40px', fontSize: '18px', background: 'transparent', border: '1px solid #fff', color: 'white', borderRadius: '30px', cursor: 'pointer' }}>
        閉じる
      </button>
    </div>
  );
};


// --- 4. カタログ画面 ---
const CardCatalogScreen = ({
  allCards,
  mode,
  onSelect,
  onClose
}: {
  allCards: CardData[],
  mode: 'leader' | 'main', // モードを受け取る
  onSelect: (card: CardData) => void,
  onClose: () => void
}) => {
  const [filterColor, setFilterColor] = useState('ALL');
  
  const filtered = useMemo(() => {
    let res = allCards;

    // 【修正】リーダー表示制御
    if (mode === 'leader') {
      res = res.filter(c => c.type === 'LEADER');
    } else {
      res = res.filter(c => c.type !== 'LEADER');
    }

    // 【修正】色の絞り込み（英語・日本語どちらでもヒットするように修正）
    if (filterColor !== 'ALL') {
        const target = filterColor.toLowerCase();
        // 英語名(red) または 日本語名(赤) のどちらかに一致すればOKとする簡易ロジック
        // 本来は辞書マッピングすべきだが、データ不整合に強くなるよう緩く判定
        const colorMap: Record<string, string> = {
            'red': '赤', 'green': '緑', 'blue': '青', 'purple': '紫', 'black': '黒', 'yellow': '黄'
        };
        const jpColor = colorMap[target] || target;

        res = res.filter(c => {
            if (!c.color || c.color.length === 0) return false;
            // データ内の色が配列であることを考慮し、各色が条件を含むか判定
            return c.color.some(cColor => {
                const cLower = String(cColor).toLowerCase();
                return cLower.includes(target) || cLower.includes(jpColor);
            });
        });
    }

    return res;
  }, [allCards, filterColor, mode]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#222', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '15px', background: '#333', borderBottom: '1px solid #444', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={onClose} style={{ padding: '5px 15px' }}>キャンセル</button>
        <div style={{ fontWeight: 'bold', color: '#aaa', fontSize: '12px' }}>
          {mode === 'leader' ? 'リーダーを選択' : 'カードを追加'}
        </div>
        <select value={filterColor} onChange={e => setFilterColor(e.target.value)} style={{ padding: '5px', flex: 1 }}>
          <option value="ALL">全色</option>
          <option value="Red">赤</option>
          <option value="Green">緑</option>
          <option value="Blue">青</option>
          <option value="Purple">紫</option>
          <option value="Black">黒</option>
          <option value="Yellow">黄</option>
        </select>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
        {filtered.length === 0 && <div style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center', marginTop: '20px' }}>条件に合うカードがありません</div>}
        {filtered.map(c => (
          <CardImageStub 
            key={c.uuid} 
            text={c.name} 
            onClick={() => onSelect(c)} 
          />
        ))}
      </div>
    </div>
  );
};


// --- 親コンポーネント (Main) ---
export const DeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const [mode, setMode] = useState<'list' | 'edit' | 'detail' | 'catalog'>('list');
  const [catalogMode, setCatalogMode] = useState<'leader' | 'main'>('main'); // カタログのモードを追加

  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [decks, setDecks] = useState<DeckData[]>([]);
  
  const [currentDeck, setCurrentDeck] = useState<DeckData | null>(null);
  const [targetCard, setTargetCard] = useState<CardData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cRes = await fetch(`${API_CONFIG.BASE_URL}/api/cards`);
        const cData = await cRes.json();
        if (cData.success) setAllCards(cData.cards);

        const dRes = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
        const dData = await dRes.json();
        if (dData.success) setDecks(dData.decks);
      } catch (e) {
        logger.error('deck_builder.init', String(e));
      }
    };
    fetchData();
  }, [mode]);

  // Actions
  const handleSelectDeck = (deck: DeckData) => {
    setCurrentDeck(deck);
    setMode('edit');
  };

  const handleCreateNew = () => {
    setCurrentDeck({ name: 'New Deck', leader_id: null, card_uuids: [], don_uuids: [] });
    setMode('edit');
  };

  const handleOpenCatalog = (cMode: 'leader' | 'main') => {
    setCatalogMode(cMode);
    setMode('catalog');
  };

  const handleCatalogSelect = (card: CardData) => {
    if (!currentDeck) return;

    // 【修正】リーダー選択モードなら即セットしてエディタに戻る
    if (catalogMode === 'leader') {
      setCurrentDeck({ ...currentDeck, leader_id: card.uuid });
      setMode('edit');
    } else {
      // メインデッキなら詳細画面へ（枚数選択）
      setTargetCard(card);
      setMode('detail');
    }
  };

  const handleSaveDeck = async () => {
    if (!currentDeck) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentDeck)
      });
      const data = await res.json();
      if (data.success) {
        alert('保存しました');
        setCurrentDeck(prev => prev ? ({...prev, id: data.deck_id}) : null);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('通信エラー');
    }
  };

  const handleChangeCount = (card: CardData, diff: number) => {
    if (!currentDeck) return;
    
    // リーダーはカタログでしか変更しないため、ここでの分岐は念のため残すが基本的に使われない
    if (card.type === 'LEADER') {
      if (diff > 0) setCurrentDeck({ ...currentDeck, leader_id: card.uuid });
      else if (currentDeck.leader_id === card.uuid) setCurrentDeck({ ...currentDeck, leader_id: null });
      return;
    }

    const newUuids = [...currentDeck.card_uuids];
    if (diff > 0) {
      if (newUuids.length < 50) newUuids.push(card.uuid);
    } else {
      const idx = newUuids.indexOf(card.uuid);
      if (idx !== -1) newUuids.splice(idx, 1);
    }
    setCurrentDeck({ ...currentDeck, card_uuids: newUuids });
  };

  // Render
  if (mode === 'list') {
    return <DeckListView decks={decks} onSelectDeck={handleSelectDeck} onCreateNew={handleCreateNew} onBack={onBack} />;
  }

  if (mode === 'edit' && currentDeck) {
    return (
      <DeckEditorView
        deck={currentDeck}
        allCards={allCards}
        onUpdateDeck={setCurrentDeck}
        onSave={handleSaveDeck}
        onBack={() => setMode('list')}
        onOpenDetail={(card) => {
          setTargetCard(card);
          setMode('detail');
        }}
        onOpenCatalog={handleOpenCatalog} // モード引数付きの関数を渡す
      />
    );
  }

  if (mode === 'detail' && targetCard && currentDeck) {
    const count = currentDeck.card_uuids.filter(id => id === targetCard.uuid).length;
    return (
      <CardDetailScreen
        card={targetCard}
        currentCount={count}
        onCountChange={(diff) => handleChangeCount(targetCard, diff)}
        onClose={() => setMode('edit')}
      />
    );
  }

  if (mode === 'catalog' && currentDeck) {
    return (
      <CardCatalogScreen
        allCards={allCards}
        mode={catalogMode} // モードを渡す
        onClose={() => setMode('edit')}
        onSelect={handleCatalogSelect} // 専用のハンドラを使用
      />
    );
  }

  return <div>Loading...</div>;
};
