import { useState, useEffect, useMemo } from 'react';
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
  traits?: string[];
  trigger_text?: string;
}

interface DeckData {
  id?: string;
  name: string;
  leader_id: string | null;
  card_uuids: string[];
  don_uuids: string[];
}

// --- 共通: 画像表示コンポーネント ---
const CardImageStub = ({ card, count, onClick }: { card: CardData | { name: string, uuid?: string }, count?: number, onClick?: () => void }) => {
  const [imgError, setImgError] = useState(false);
  const imageUrl = card.uuid ? `${API_CONFIG.IMAGE_BASE_URL}/${card.uuid}.png` : null;

  return (
    <div 
      onClick={onClick}
      style={{
        width: '80px',
        height: '112px',
        background: '#444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '10px',
        textAlign: 'center',
        position: 'relative',
        borderRadius: '4px',
        border: '1px solid #666',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}
    >
      {imageUrl && !imgError ? (
        <img 
          src={imageUrl} 
          alt={card.name}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ padding: '5px' }}>{card.name || "No DATA"}</span>
      )}
      
      {count !== undefined && (
        <div style={{
          position: 'absolute', top: '2px', right: '2px', background: '#e74c3c', color: 'white',
          borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', border: '1px solid white',
          zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
        }}>
          {count}
        </div>
      )}
    </div>
  );
};

// --- 共通: カード詳細画面 ---
const CardDetailScreen = ({
  card,
  currentCount,
  onCountChange,
  onClose,
  onNavigate
}: {
  card: CardData,
  currentCount: number,
  onCountChange: (diff: number) => void,
  onClose: () => void,
  onNavigate?: (direction: -1 | 1) => void
}) => {
  const imageUrl = `${API_CONFIG.IMAGE_BASE_URL}/${card.uuid}.png`;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
        {onNavigate && (
          <button onClick={() => onNavigate(-1)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '40px', cursor: 'pointer', padding: '10px' }}>‹</button>
        )}

        <div style={{ width: '240px', position: 'relative' }}>
          <img 
            src={imageUrl} 
            alt={card.name} 
            style={{ width: '100%', borderRadius: '10px', border: '2px solid #fff' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = `<div style="width:240px;height:336px;background:#444;color:white;display:flex;align-items:center;justify-content:center;border:2px solid #fff;border-radius:10px;">${card.name}</div>`;
            }}
          />
        </div>

        {onNavigate && (
          <button onClick={() => onNavigate(1)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '40px', cursor: 'pointer', padding: '10px' }}>›</button>
        )}
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
                <div style={{ width: '50px', height: '70px', background: '#222', border: '1px solid #555', borderRadius: '4px', marginRight: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#aaa', overflow: 'hidden', flexShrink: 0 }}>
                    {deck.leader_id ? (
                      <img 
                        src={`${API_CONFIG.IMAGE_BASE_URL}/${deck.leader_id}.png`}
                        alt="leader"
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerText = deck.leader_id || "Err"; }}
                      />
                    ) : "No Leader"}
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
  onOpenCatalog
}: {
  deck: DeckData,
  allCards: CardData[],
  onUpdateDeck: (d: DeckData) => void,
  onSave: () => void,
  onBack: () => void,
  onOpenCatalog: (mode: 'leader' | 'main') => void
}) => {
  const [viewingCard, setViewingCard] = useState<CardData | null>(null);

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
    
    list.sort((a, b) => (a.card.cost || 0) - (b.card.cost || 0));

    return { leaderCard, list };
  }, [deck.card_uuids, deck.leader_id, allCards]);

  const handleCountChange = (card: CardData, diff: number) => {
    const newUuids = [...deck.card_uuids];
    if (diff > 0) {
      if (newUuids.length < 50) newUuids.push(card.uuid);
    } else {
      const idx = newUuids.indexOf(card.uuid);
      if (idx !== -1) newUuids.splice(idx, 1);
    }
    onUpdateDeck({ ...deck, card_uuids: newUuids });
  };

  const handleNavigate = (direction: -1 | 1) => {
    if (!viewingCard) return;
    const currentIndex = groupedCards.list.findIndex(item => item.card.uuid === viewingCard.uuid);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < groupedCards.list.length) {
      setViewingCard(groupedCards.list[nextIndex].card);
    }
  };

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
            card={groupedCards.leaderCard || { name: "Select Leader" }}
            onClick={() => onOpenCatalog('leader')} 
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', justifyItems: 'center' }}>
          <div 
            onClick={() => onOpenCatalog('main')} 
            style={{ width: '80px', height: '112px', border: '2px dashed #666', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', fontSize: '24px' }}
          >
            ＋
          </div>
          {groupedCards.list.map((item) => (
            <CardImageStub 
              key={item.card.uuid}
              card={item.card}
              count={item.count} 
              onClick={() => setViewingCard(item.card)} 
            />
          ))}
        </div>
      </div>

      {viewingCard && (
        <CardDetailScreen
          card={viewingCard}
          currentCount={deck.card_uuids.filter(id => id === viewingCard.uuid).length}
          onCountChange={(diff) => handleCountChange(viewingCard, diff)}
          onClose={() => setViewingCard(null)}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
};


// --- 4. カタログ画面 (全フィルタ実装版) ---
const CardCatalogScreen = ({
  allCards,
  mode,
  currentDeck, 
  onUpdateDeck,
  onClose
}: {
  allCards: CardData[],
  mode: 'leader' | 'main',
  currentDeck: DeckData,
  onUpdateDeck: (d: DeckData) => void,
  onClose: () => void
}) => {
  // フィルタ用ステート
  const [filterColor, setFilterColor] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterAttribute, setFilterAttribute] = useState('ALL');
  const [filterTrait, setFilterTrait] = useState('ALL');
  const [filterCounter, setFilterCounter] = useState('ALL');
  const [filterCost, setFilterCost] = useState('ALL');
  const [filterPower, setFilterPower] = useState('ALL');
  const [filterTrigger, setFilterTrigger] = useState('ALL');
  const [filterSet, setFilterSet] = useState('ALL'); // 【追加】収録セット
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState<'COST' | 'POWER' | 'ID'>('COST');
  
  const [displayLimit, setDisplayLimit] = useState(50);
  const [viewingCard, setViewingCard] = useState<CardData | null>(null);

  const traitList = useMemo(() => {
    const traits = new Set<string>();
    allCards.forEach(c => c.traits?.forEach(t => traits.add(t)));
    return Array.from(traits).sort();
  }, [allCards]);

  // 【追加】セットリスト生成 (OP01, ST01などを抽出)
  const setList = useMemo(() => {
    const sets = new Set<string>();
    allCards.forEach(c => {
      if (c.uuid) {
        // ハイフン区切りの最初の部分をセットIDとみなす
        const parts = c.uuid.split('-');
        if (parts.length > 1) {
          sets.add(parts[0]);
        }
      }
    });
    return Array.from(sets).sort();
  }, [allCards]);

  const filtered = useMemo(() => {
    let res = allCards;

    if (mode === 'leader') res = res.filter(c => c.type === 'LEADER');
    else res = res.filter(c => c.type !== 'LEADER');

    // 1. 色
    if (filterColor !== 'ALL') {
        const target = filterColor.toLowerCase();
        const colorMap: Record<string, string> = { 'red': '赤', 'green': '緑', 'blue': '青', 'purple': '紫', 'black': '黒', 'yellow': '黄' };
        const jpColor = colorMap[target] || target;
        res = res.filter(c => {
            if (!c.color || c.color.length === 0) return false;
            return c.color.some(cColor => {
                const cLower = String(cColor).toLowerCase();
                return cLower.includes(target) || cLower.includes(jpColor);
            });
        });
    }

    // 2. 種類
    if (filterType !== 'ALL') res = res.filter(c => c.type === filterType);

    // 3. 属性
    if (filterAttribute !== 'ALL') res = res.filter(c => c.attributes?.includes(filterAttribute));

    // 4. 特徴
    if (filterTrait !== 'ALL') res = res.filter(c => c.traits?.some(t => t.includes(filterTrait)));

    // 5. カウンター
    if (filterCounter !== 'ALL') {
      if (filterCounter === 'NONE') res = res.filter(c => !c.counter);
      else res = res.filter(c => c.counter === parseInt(filterCounter));
    }

    // 6. コスト
    if (filterCost !== 'ALL') {
      const val = parseInt(filterCost);
      if (val >= 10) res = res.filter(c => (c.cost || 0) >= 10);
      else res = res.filter(c => c.cost === val);
    }

    // 7. パワー
    if (filterPower !== 'ALL') {
      const val = parseInt(filterPower);
      if (val >= 10000) res = res.filter(c => (c.power || 0) >= 10000);
      else res = res.filter(c => c.power === val);
    }

    // 8. トリガー
    if (filterTrigger !== 'ALL') {
      if (filterTrigger === 'HAS') res = res.filter(c => !!c.trigger_text);
      if (filterTrigger === 'NONE') res = res.filter(c => !c.trigger_text);
    }

    // 9. 収録セット 【追加】
    if (filterSet !== 'ALL') {
        res = res.filter(c => c.uuid.startsWith(filterSet));
    }

    // 10. テキスト検索
    if (searchText) {
      const lower = searchText.toLowerCase();
      res = res.filter(c => 
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.text && c.text.toLowerCase().includes(lower)) ||
        (c.attributes && c.attributes.some(a => a.toLowerCase().includes(lower))) ||
        (c.type && c.type.toLowerCase().includes(lower)) ||
        (c.traits && c.traits.some(t => t.toLowerCase().includes(lower)))
      );
    }

    // ソート
    res = [...res].sort((a, b) => {
      if (sortType === 'COST') return (a.cost || 0) - (b.cost || 0) || a.uuid.localeCompare(b.uuid);
      if (sortType === 'POWER') return (a.power || 0) - (b.power || 0) || a.uuid.localeCompare(b.uuid);
      return a.uuid.localeCompare(b.uuid);
    });

    return res;
  }, [allCards, filterColor, filterType, filterAttribute, filterTrait, filterCounter, filterCost, filterPower, filterTrigger, filterSet, mode, searchText, sortType]);

  useEffect(() => {
    setDisplayLimit(50);
  }, [filterColor, filterType, filterAttribute, filterTrait, filterCounter, filterCost, filterPower, filterTrigger, filterSet, mode, searchText, sortType]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      if (displayLimit < filtered.length) setDisplayLimit(prev => prev + 50);
    }
  };

  const displayCards = filtered.slice(0, displayLimit);

  const handleSelect = (card: CardData) => {
    if (mode === 'leader') {
      onUpdateDeck({ ...currentDeck, leader_id: card.uuid });
      onClose();
    } else {
      setViewingCard(card);
    }
  };

  const handleCountChange = (card: CardData, diff: number) => {
    const newUuids = [...currentDeck.card_uuids];
    if (diff > 0) {
      if (newUuids.length < 50) newUuids.push(card.uuid);
    } else {
      const idx = newUuids.indexOf(card.uuid);
      if (idx !== -1) newUuids.splice(idx, 1);
    }
    onUpdateDeck({ ...currentDeck, card_uuids: newUuids });
  };

  const handleNavigate = (direction: -1 | 1) => {
    if (!viewingCard) return;
    const currentIndex = filtered.findIndex(c => c.uuid === viewingCard.uuid);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < filtered.length) {
      setViewingCard(filtered[nextIndex]);
    }
  };

  const selectStyle = { padding: '5px', borderRadius: '4px', flexShrink: 0, maxWidth: '120px' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#222', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      
      {/* フィルタエリア */}
      <div style={{ padding: '10px', background: '#333', borderBottom: '1px solid #444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={onClose} style={{ padding: '5px 15px' }}>完了</button>
          <input 
            placeholder="キーワード検索..." 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: 'none' }}
          />
          <span style={{ fontSize: '12px', color: '#aaa' }}>{filtered.length}枚</span>
        </div>
        
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
          <select value={filterColor} onChange={e => setFilterColor(e.target.value)} style={selectStyle}>
            <option value="ALL">色:全て</option>
            <option value="Red">赤</option>
            <option value="Green">緑</option>
            <option value="Blue">青</option>
            <option value="Purple">紫</option>
            <option value="Black">黒</option>
            <option value="Yellow">黄</option>
          </select>

          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
            <option value="ALL">種類:全て</option>
            <option value="CHARACTER">キャラ</option>
            <option value="EVENT">イベント</option>
            <option value="STAGE">ステージ</option>
          </select>

          {/* 【追加】収録セットフィルタ */}
          <select value={filterSet} onChange={e => setFilterSet(e.target.value)} style={selectStyle}>
            <option value="ALL">セット:全て</option>
            {setList.map(s => (
                <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select value={filterAttribute} onChange={e => setFilterAttribute(e.target.value)} style={selectStyle}>
            <option value="ALL">属性:全て</option>
            <option value="打">打</option>
            <option value="斬">斬</option>
            <option value="特">特</option>
            <option value="射">射</option>
            <option value="知">知</option>
          </select>

          <select value={filterCost} onChange={e => setFilterCost(e.target.value)} style={selectStyle}>
            <option value="ALL">コスト:全て</option>
            {[...Array(10)].map((_, i) => <option key={i} value={i+1}>{i+1}</option>)}
            <option value="10">10+</option>
          </select>

          <select value={filterPower} onChange={e => setFilterPower(e.target.value)} style={selectStyle}>
            <option value="ALL">パワー:全て</option>
            {[...Array(10)].map((_, i) => <option key={i} value={i*1000}>{i*1000}</option>)}
            <option value="10000">10000+</option>
          </select>

          <select value={filterCounter} onChange={e => setFilterCounter(e.target.value)} style={selectStyle}>
            <option value="ALL">カウンター:全て</option>
            <option value="NONE">なし</option>
            <option value="1000">+1000</option>
            <option value="2000">+2000</option>
          </select>

          <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)} style={selectStyle}>
            <option value="ALL">トリガー:全て</option>
            <option value="HAS">あり</option>
            <option value="NONE">なし</option>
          </select>

          <select value={filterTrait} onChange={e => setFilterTrait(e.target.value)} style={{...selectStyle, maxWidth: '150px'}}>
            <option value="ALL">特徴:全て</option>
            {traitList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={sortType} onChange={e => setSortType(e.target.value as any)} style={selectStyle}>
            <option value="COST">コスト順</option>
            <option value="POWER">パワー順</option>
            <option value="ID">ID順</option>
          </select>
        </div>
      </div>

      <div 
        onScroll={handleScroll} 
        style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', alignContent: 'start' }}
      >
        {displayCards.length === 0 && <div style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center', marginTop: '20px' }}>条件に合うカードがありません</div>}
        
        {displayCards.map(c => {
          const countInDeck = currentDeck.card_uuids.filter(id => id === c.uuid).length;
          return (
            <CardImageStub 
              key={c.uuid} 
              card={c} 
              count={countInDeck > 0 ? countInDeck : undefined} 
              onClick={() => handleSelect(c)} 
            />
          );
        })}
        
        {displayLimit < filtered.length && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#666' }}>Reading more...</div>
        )}
      </div>

      {viewingCard && mode === 'main' && (
        <CardDetailScreen
          card={viewingCard}
          currentCount={currentDeck.card_uuids.filter(id => id === viewingCard.uuid).length}
          onCountChange={(diff) => handleCountChange(viewingCard, diff)}
          onClose={() => setViewingCard(null)}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
};


// --- 親コンポーネント (Main) ---
export const DeckBuilder = ({ onBack }: { onBack: () => void }) => {
  const [mode, setMode] = useState<'list' | 'edit' | 'catalog'>('list');
  const [catalogMode, setCatalogMode] = useState<'leader' | 'main'>('main');

  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [decks, setDecks] = useState<DeckData[]>([]);
  
  const [currentDeck, setCurrentDeck] = useState<DeckData | null>(null);

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
        onOpenCatalog={handleOpenCatalog} 
      />
    );
  }

  if (mode === 'catalog' && currentDeck) {
    return (
      <CardCatalogScreen
        allCards={allCards}
        mode={catalogMode}
        currentDeck={currentDeck}
        onUpdateDeck={setCurrentDeck}
        onClose={() => setMode('edit')}
      />
    );
  }

  return <div>Loading...</div>;
};
