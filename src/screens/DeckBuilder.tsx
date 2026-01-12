import { useState, useEffect, useMemo } from 'react';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../api/api.config';

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

interface FilterState {
  color: string[];
  type: string[];
  attribute: string[];
  trait: string;
  counter: string[];
  cost: string[];
  power: string[];
  trigger: string[];
  set: string;
  sort: string;
}

const CardImageStub = ({ card, count, onClick }: { card: CardData | { name: string, uuid?: string }, count?: number, onClick?: () => void }) => {
  const [imgError, setImgError] = useState(false);
  const imageUrl = card.uuid ? `${API_CONFIG.IMAGE_BASE_URL}/${card.uuid}.png` : null;

  return (
    <div 
      onClick={onClick}
      style={{
        width: '80px', height: '112px', background: '#444',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: '10px', textAlign: 'center', position: 'relative',
        borderRadius: '4px', border: '1px solid #666', cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)', overflow: 'hidden'
      }}
    >
      {imageUrl && !imgError ? (
        <img 
          src={imageUrl} alt={card.name} loading="lazy"
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

const CardDetailScreen = ({ card, currentCount, onCountChange, onClose, onNavigate, viewOnly }: {
  card: CardData, currentCount: number, onCountChange: (diff: number) => void, onClose: () => void, onNavigate?: (direction: -1 | 1) => void, viewOnly?: boolean
}) => {
  const imageUrl = `${API_CONFIG.IMAGE_BASE_URL}/${card.uuid}.png`;
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (onNavigate) {
      if (isLeftSwipe) onNavigate(1);
      if (isRightSwipe) onNavigate(-1);
    }
  };

  return (
    <div 
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        background: 'rgba(0,0,0,0.95)', zIndex: 100, 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        padding: '20px', touchAction: 'none'
      }}
    >
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'center', width: '100%' }}>
        <img 
          src={imageUrl} alt={card.name} 
          style={{ 
            height: '55vh',
            maxHeight: '600px',
            maxWidth: '90vw',
            objectFit: 'contain',
            borderRadius: '12px', 
            border: '2px solid #fff',
            boxShadow: '0 0 20px rgba(0,0,0,0.8)'
          }}
          onError={(e) => { 
            (e.target as HTMLImageElement).style.display = 'none'; 
            e.currentTarget.parentElement!.innerHTML = `<div style="width:300px;height:420px;background:#444;color:white;display:flex;align-items:center;justify-content:center;border:2px solid #fff;border-radius:10px;font-size:20px;">${card.name}</div>`; 
          }}
        />
      </div>

      {!viewOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '40px' }}>
          <button onClick={() => onCountChange(-1)} disabled={currentCount <= 0} style={{ width: '70px', height: '70px', borderRadius: '50%', border: 'none', background: currentCount > 0 ? '#e74c3c' : '#444', color: 'white', fontSize: '28px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.4)' }}>－</button>
          <div style={{ fontSize: '64px', fontWeight: 'bold', color: 'white', width: '80px', textAlign: 'center', textShadow: '0 2px 4px black' }}>{currentCount}</div>
          <button onClick={() => onCountChange(1)} disabled={currentCount >= 4} style={{ width: '70px', height: '70px', borderRadius: '50%', border: 'none', background: currentCount < 4 ? '#3498db' : '#444', color: 'white', fontSize: '28px', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.4)' }}>＋</button>
        </div>
      )}

      <button onClick={onClose} style={{ padding: '12px 50px', fontSize: '16px', background: 'rgba(255,255,255,0.1)', border: '1px solid #888', color: '#ddd', borderRadius: '30px', cursor: 'pointer' }}>閉じる</button>
      {onNavigate && <div style={{ position: 'absolute', bottom: '20px', color: '#666', fontSize: '12px' }}>↔ Swipe to Navigate</div>}
    </div>
  );
};

const FilterModal = ({ filters, setFilters, traitList, setList, onClose, onReset }: { filters: FilterState, setFilters: (f: FilterState) => void, traitList: string[], setList: string[], onClose: () => void, onReset: () => void }) => {
  const SectionTitle = ({ children }: { children: string }) => (
    <div style={{ color: '#aaa', fontSize: '12px', marginTop: '15px', marginBottom: '8px', fontWeight: 'bold' }}>{children}</div>
  );

  const toggle = (key: keyof FilterState, value: string) => {
    const current = filters[key];
    if (Array.isArray(current)) {
      const newArray = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      setFilters({ ...filters, [key]: newArray });
    }
  };

  const FilterBtn = ({ label, active, onClick, color }: { label: string, active: boolean, onClick: () => void, color?: string }) => (
    <button 
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: '20px',
        border: active ? `2px solid ${color || '#3498db'}` : '1px solid #555',
        background: active ? (color || '#3498db') : '#333',
        color: 'white',
        fontSize: '12px',
        fontWeight: active ? 'bold' : 'normal',
        cursor: 'pointer',
        minWidth: '40px'
      }}
    >
      {label}
    </button>
  );

  const ColorBtn = ({ colorKey, label, colorCode }: { colorKey: string, label: string, colorCode: string }) => {
    const isActive = filters.color.includes(colorKey);
    return (
      <div 
        title={label}
        onClick={() => toggle('color', colorKey)}
        style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: colorCode,
          border: isActive ? '3px solid white' : '2px solid transparent',
          boxShadow: isActive ? '0 0 10px white' : 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'black', fontWeight: 'bold', fontSize: '10px',
          opacity: (filters.color.length === 0 || isActive) ? 1 : 0.4
        }}
      >
        {isActive && "✓"}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 60, display: 'flex' }}>
      <div style={{ width: '100%', background: '#222', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>フィルタ設定</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
          <SectionTitle>色 (COLOR)</SectionTitle>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <ColorBtn colorKey="Red" label="赤" colorCode="#e74c3c" />
            <ColorBtn colorKey="Green" label="緑" colorCode="#27ae60" />
            <ColorBtn colorKey="Blue" label="青" colorCode="#3498db" />
            <ColorBtn colorKey="Purple" label="紫" colorCode="#9b59b6" />
            <ColorBtn colorKey="Black" label="黒" colorCode="#34495e" />
            <ColorBtn colorKey="Yellow" label="黄" colorCode="#f1c40f" />
          </div>
          <SectionTitle>コスト (COST)</SectionTitle>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[...Array(10)].map((_, i) => (
              <FilterBtn key={i} label={`${i+1}`} active={filters.cost.includes(`${i+1}`)} onClick={() => toggle('cost', `${i+1}`)} />
            ))}
            <FilterBtn label="10+" active={filters.cost.includes('10')} onClick={() => toggle('cost', '10')} />
          </div>
          <SectionTitle>パワー (POWER)</SectionTitle>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[...Array(13)].map((_, i) => (
              <FilterBtn key={i} label={`${i}`} active={filters.power.includes(`${i}`)} onClick={() => toggle('power', `${i}`)} />
            ))}
            <FilterBtn label="13~" active={filters.power.includes('13')} onClick={() => toggle('power', '13')} />
          </div>
          <SectionTitle>種類 (TYPE)</SectionTitle>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <FilterBtn label="リーダー" active={filters.type.includes('LEADER')} onClick={() => toggle('type', 'LEADER')} />
            <FilterBtn label="キャラ" active={filters.type.includes('CHARACTER')} onClick={() => toggle('type', 'CHARACTER')} />
            <FilterBtn label="イベント" active={filters.type.includes('EVENT')} onClick={() => toggle('type', 'EVENT')} />
            <FilterBtn label="ステージ" active={filters.type.includes('STAGE')} onClick={() => toggle('type', 'STAGE')} />
          </div>
          <SectionTitle>カウンター (COUNTER)</SectionTitle>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <FilterBtn label="なし" active={filters.counter.includes('NONE')} onClick={() => toggle('counter', 'NONE')} />
            <FilterBtn label="+1000" active={filters.counter.includes('1000')} onClick={() => toggle('counter', '1000')} />
            <FilterBtn label="+2000" active={filters.counter.includes('2000')} onClick={() => toggle('counter', '2000')} />
          </div>
          <SectionTitle>トリガー (TRIGGER)</SectionTitle>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <FilterBtn label="あり" active={filters.trigger.includes('HAS')} onClick={() => toggle('trigger', 'HAS')} />
            <FilterBtn label="なし" active={filters.trigger.includes('NONE')} onClick={() => toggle('trigger', 'NONE')} />
          </div>
          <SectionTitle>属性 (ATTRIBUTE)</SectionTitle>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['打', '斬', '特', '射', '知'].map(attr => (
              <FilterBtn key={attr} label={attr} active={filters.attribute.includes(attr)} onClick={() => toggle('attribute', attr)} />
            ))}
          </div>
          <SectionTitle>収録セット (SET)</SectionTitle>
          <select value={filters.set} onChange={(e) => setFilters({ ...filters, set: e.target.value })} style={{ width: '100%', padding: '10px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}>
            <option value="ALL">すべて</option>
            {setList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <SectionTitle>特徴 (TRAITS)</SectionTitle>
          <select value={filters.trait} onChange={(e) => setFilters({ ...filters, trait: e.target.value })} style={{ width: '100%', padding: '10px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}>
            <option value="ALL">すべて</option>
            {traitList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ padding: '15px', borderTop: '1px solid #444', display: 'flex', gap: '10px' }}>
          <button onClick={onReset} style={{ flex: 1, padding: '12px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: 'white', cursor: 'pointer' }}>リセット</button>
          <button onClick={onClose} style={{ flex: 2, padding: '12px', borderRadius: '4px', border: 'none', background: '#e74c3c', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>決定</button>
        </div>
      </div>
    </div>
  );
};

const DeckDistributionModal = ({ deck, allCards, onClose }: { deck: DeckData, allCards: CardData[], onClose: () => void }) => {
  const stats = useMemo(() => {
    const cards = deck.card_uuids.map(uuid => allCards.find(c => c.uuid === uuid)).filter(Boolean) as CardData[];
    const costs: Record<string, number> = {};
    const counters: Record<string, number> = { 'NONE': 0, '1000': 0, '2000': 0 };
    const traits: Record<string, number> = {};

    cards.forEach(c => {
      const cost = c.cost !== undefined ? (c.cost >= 10 ? '10+' : c.cost.toString()) : '0';
      costs[cost] = (costs[cost] || 0) + 1;
      const counter = c.counter ? c.counter.toString() : 'NONE';
      if (counters[counter] !== undefined) counters[counter]++;
      c.traits?.forEach(t => { traits[t] = (traits[t] || 0) + 1; });
    });

    return {
      costs: Object.entries(costs).sort((a, b) => (a[0] === '10+' ? 10 : parseInt(a[0])) - (b[0] === '10+' ? 10 : parseInt(b[0]))),
      counters: Object.entries(counters),
      traits: Object.entries(traits).sort((a, b) => b[1] - a[1]).slice(0, 10)
    };
  }, [deck.card_uuids, allCards]);

  const StatSection = ({ title, data }: { title: string, data: [string, number][] }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 'bold', borderLeft: '3px solid #e74c3c', paddingLeft: '8px', marginBottom: '10px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {data.map(([key, count]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '60px', fontSize: '12px' }}>{key}</div>
            <div style={{ flex: 1, height: '12px', background: '#444', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${(count / 50) * 100}%`, height: '100%', background: '#3498db' }} />
            </div>
            <div style={{ width: '30px', fontSize: '12px', textAlign: 'right' }}>{count}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#222', width: '100%', maxWidth: '400px', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>デッキ分布</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <StatSection title="コスト分布" data={stats.costs} />
          <StatSection title="カウンター分布" data={stats.counters} />
          <StatSection title="特徴 (Top 10)" data={stats.traits} />
        </div>
      </div>
    </div>
  );
};

const DeckListView = ({ decks, onSelectDeck, onCreateNew, onBack }: { decks: DeckData[], onSelectDeck: (deck: DeckData) => void, onCreateNew: () => void, onBack: () => void }) => {
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
                      <img src={`${API_CONFIG.IMAGE_BASE_URL}/${deck.leader_id}.png`} alt="leader" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerText = deck.leader_id || "Err"; }} />
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

const DeckEditorView = ({ deck, allCards, onUpdateDeck, onSave, onBack, onOpenCatalog }: { deck: DeckData, allCards: CardData[], onUpdateDeck: (d: DeckData) => void, onSave: () => void, onBack: () => void, onOpenCatalog: (mode: 'leader' | 'main') => void }) => {
  const [viewingCard, setViewingCard] = useState<CardData | null>(null);
  const [showStats, setShowStats] = useState(false);
  const groupedCards = useMemo(() => {
    const map = new Map<string, number>();
    deck.card_uuids.forEach(uuid => { map.set(uuid, (map.get(uuid) || 0) + 1); });
    const leaderCard = allCards.find(c => c.uuid === deck.leader_id);
    const list: { card: CardData, count: number }[] = [];
    map.forEach((count, uuid) => { const card = allCards.find(c => c.uuid === uuid); if (card) list.push({ card, count }); });
    list.sort((a, b) => (a.card.cost || 0) - (b.card.cost || 0));
    return { leaderCard, list };
  }, [deck.card_uuids, deck.leader_id, allCards]);

  const handleCountChange = (card: CardData, diff: number) => {
    const newUuids = [...deck.card_uuids];
    if (diff > 0) { if (newUuids.length < 50) newUuids.push(card.uuid); } 
    else { const idx = newUuids.indexOf(card.uuid); if (idx !== -1) newUuids.splice(idx, 1); }
    onUpdateDeck({ ...deck, card_uuids: newUuids });
  };

  const handleNavigate = (direction: -1 | 1) => {
    if (!viewingCard) return;
    const currentIndex = groupedCards.list.findIndex(item => item.card.uuid === viewingCard.uuid);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < groupedCards.list.length) { setViewingCard(groupedCards.list[nextIndex].card); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#222', color: '#eee' }}>
      <div style={{ padding: '10px', background: '#333', borderBottom: '1px solid #444', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '10px', alignItems: 'center' }}>
        <button onClick={onBack} style={{ padding: '5px 10px', cursor: 'pointer' }}>←</button>
        <input value={deck.name} onChange={e => onUpdateDeck({...deck, name: e.target.value})} style={{ background: '#222', color: 'white', border: '1px solid #555', padding: '5px', borderRadius: '4px' }} />
        <button onClick={() => setShowStats(true)} style={{ padding: '5px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>📊</button>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{deck.card_uuids.length}/50</div>
        <button onClick={onSave} style={{ padding: '5px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存</button>
      </div>
      <div style={{ padding: '10px', background: '#2a2a2a', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>LEADER</div>
          <CardImageStub card={groupedCards.leaderCard || { name: "Select Leader" }} onClick={() => onOpenCatalog('leader')} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', justifyItems: 'center' }}>
          <div onClick={() => onOpenCatalog('main')} style={{ width: '80px', height: '112px', border: '2px dashed #666', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', cursor: 'pointer', fontSize: '24px' }}>＋</div>
          {groupedCards.list.map((item) => ( <CardImageStub key={item.card.uuid} card={item.card} count={item.count} onClick={() => setViewingCard(item.card)} /> ))}
        </div>
      </div>
      {viewingCard && ( <CardDetailScreen card={viewingCard} currentCount={deck.card_uuids.filter(id => id === viewingCard.uuid).length} onCountChange={(diff) => handleCountChange(viewingCard, diff)} onClose={() => setViewingCard(null)} onNavigate={handleNavigate} /> )}
      {showStats && <DeckDistributionModal deck={deck} allCards={allCards} onClose={() => setShowStats(false)} />}
    </div>
  );
};

const CardCatalogScreen = ({ allCards, mode, currentDeck, onUpdateDeck, onClose, viewOnly }: { allCards: CardData[], mode: 'leader' | 'main', currentDeck: DeckData, onUpdateDeck: (d: DeckData) => void, onClose: () => void, viewOnly?: boolean }) => {
  const [filters, setFilters] = useState<FilterState>({
    color: [], type: [], attribute: [], trait: 'ALL', counter: [], cost: [], power: [], trigger: [], set: 'ALL', sort: 'COST'
  });
  const [searchText, setSearchText] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [viewingCard, setViewingCard] = useState<CardData | null>(null);

  const traitList = useMemo(() => {
    const traits = new Set<string>();
    allCards.forEach(c => c.traits?.forEach(t => traits.add(t)));
    return Array.from(traits).sort();
  }, [allCards]);

  const setList = useMemo(() => {
    const sets = new Set<string>();
    allCards.forEach(c => { if (c.uuid) { const parts = c.uuid.split('-'); if (parts.length > 1) sets.add(parts[0]); } });
    return Array.from(sets).sort();
  }, [allCards]);

  const isFilterActive = useMemo(() => {
    return Object.entries(filters).some(([key, val]) => {
      if (key === 'sort') return val !== 'COST';
      if (Array.isArray(val)) return val.length > 0;
      return val !== 'ALL';
    });
  }, [filters]);

  const filtered = useMemo(() => {
    let res = allCards;
    const leaderCard = allCards.find(c => c.uuid === currentDeck.leader_id);
    const leaderColors = (leaderCard?.color || []).flatMap(c => c.split(/[\/／]/)).map(c => c.trim().toLowerCase());

    if (mode === 'main') {
      if (!viewOnly) {
          res = res.filter(c => c.type !== 'LEADER');
          if (leaderColors.length > 0) {
            res = res.filter(c => {
               const cardColors = (c.color || []).flatMap(cc => cc.split(/[\/／]/)).map(cc => cc.trim().toLowerCase());
               return cardColors.length > 0 && cardColors.every(cc => leaderColors.includes(cc));
            });
          }
      }
    } else { res = res.filter(c => c.type === 'LEADER'); }

    if (filters.color.length > 0) res = res.filter(c => c.color && c.color.some(cc => filters.color.includes(cc)));
    if (filters.type.length > 0) res = res.filter(c => filters.type.includes(c.type));
    if (filters.attribute.length > 0) res = res.filter(c => c.attributes?.some(attr => filters.attribute.includes(attr)));
    if (filters.trait !== 'ALL') res = res.filter(c => c.traits?.some(t => t.includes(filters.trait)));
    if (filters.counter.length > 0) {
      res = res.filter(c => {
        if (filters.counter.includes('NONE') && !c.counter) return true;
        return c.counter && filters.counter.includes(c.counter.toString());
      });
    }
    if (filters.cost.length > 0) {
      res = res.filter(c => {
        const costVal = c.cost || 0;
        if (filters.cost.includes('10') && costVal >= 10) return true;
        return filters.cost.includes(costVal.toString());
      });
    }
    if (filters.power.length > 0) {
      res = res.filter(c => {
        const pwrVal = c.power || 0;
        return filters.power.some(p => p === '13' ? pwrVal >= 13000 : pwrVal === parseInt(p) * 1000);
      });
    }
    if (filters.trigger.length > 0) {
      res = res.filter(c => filters.trigger.includes(c.trigger_text ? 'HAS' : 'NONE'));
    }
    if (filters.set !== 'ALL') res = res.filter(c => c.uuid.startsWith(filters.set));

    if (searchText) {
      const lower = searchText.toLowerCase();
      res = res.filter(c => (c.name?.toLowerCase().includes(lower)) || (c.text?.toLowerCase().includes(lower)));
    }

    const typeOrder: Record<string, number> = { 'LEADER': 1, 'CHARACTER': 2, 'EVENT': 3, 'STAGE': 4 };
    return [...res].sort((a, b) => {
      const orderA = typeOrder[a.type || ''] || 99;
      const orderB = typeOrder[b.type || ''] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.cost || 0) - (b.cost || 0) || a.uuid.localeCompare(b.uuid);
    });
  }, [allCards, filters, mode, searchText, currentDeck.leader_id, viewOnly]);

  useEffect(() => { setDisplayLimit(50); }, [filters, mode, searchText]);

  const handleSelect = (card: CardData) => {
    if (viewOnly) { setViewingCard(card); return; }
    if (mode === 'leader') { onUpdateDeck({ ...currentDeck, leader_id: card.uuid }); onClose(); }
    else { setViewingCard(card); }
  };

  const handleCountChange = (card: CardData, diff: number) => {
    const newUuids = [...currentDeck.card_uuids];
    if (diff > 0) { if (newUuids.length < 50) newUuids.push(card.uuid); }
    else { const idx = newUuids.indexOf(card.uuid); if (idx !== -1) newUuids.splice(idx, 1); }
    onUpdateDeck({ ...currentDeck, card_uuids: newUuids });
  };

  const handleNavigate = (direction: -1 | 1) => {
    if (!viewingCard) return;
    const currentIndex = filtered.findIndex(c => c.uuid === viewingCard.uuid);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < filtered.length) { setViewingCard(filtered[nextIndex]); }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (displayLimit < filtered.length) setDisplayLimit(prev => prev + 50);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#222', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '5px 15px', background: '#2a2a2a', color: '#aaa', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
        <span>{mode === 'leader' ? 'リーダー選択' : 'カード追加'}</span>
        <span>Hit: {filtered.length}枚</span>
      </div>
      <div onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', alignContent: 'start' }}>
        {filtered.slice(0, displayLimit).map(c => {
          const count = currentDeck.card_uuids.filter(u => u === c.uuid).length;
          return <CardImageStub key={c.uuid} card={c} count={count > 0 ? count : undefined} onClick={() => handleSelect(c)} />;
        })}
      </div>
      <div style={{ 
        padding: '12px 15px 45px 15px', 
        background: '#333', 
        borderTop: '1px solid #444', 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center',
        zIndex: 10
      }}>
        <button onClick={onClose} style={{ padding: '10px 16px', background: '#555', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', flexShrink: 0, cursor: 'pointer' }}>
          完了
        </button>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <input 
            placeholder="キーワード検索" 
            value={searchText} 
            onChange={e => setSearchText(e.target.value)} 
            style={{ 
              width: '100%', 
              padding: '10px 10px 10px 35px', 
              borderRadius: '20px', 
              border: 'none', 
              background: '#222', 
              color: 'white',
              fontSize: '14px',
              boxSizing: 'border-box'
            }} 
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#777', pointerEvents: 'none' }}>🔍</span>
        </div>
        <button 
          onClick={() => setShowFilterModal(true)} 
          style={{ 
            width: '40px', height: '40px', borderRadius: '50%', 
            background: isFilterActive ? '#3498db' : '#444', 
            border: 'none', color: 'white', cursor: 'pointer',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ⚙️
        </button>
      </div>
      {viewingCard && (
        <CardDetailScreen 
          card={viewingCard} 
          currentCount={currentDeck.card_uuids.filter(u => u === viewingCard.uuid).length} 
          onCountChange={(diff) => handleCountChange(viewingCard, diff)} 
          onClose={() => setViewingCard(null)} 
          onNavigate={handleNavigate}
          viewOnly={viewOnly} 
        />
      )}
      {showFilterModal && (
        <FilterModal 
          filters={filters} 
          setFilters={setFilters} 
          traitList={traitList} 
          setList={setList} 
          onClose={() => setShowFilterModal(false)} 
          onReset={() => setFilters({ color: [], type: [], attribute: [], trait: 'ALL', counter: [], cost: [], power: [], trigger: [], set: 'ALL', sort: 'COST' })} 
        />
      )}
    </div>
  );
};

export const DeckBuilder = ({ onBack, viewOnly = false }: { onBack: () => void, viewOnly?: boolean }) => {
  const [mode, setMode] = useState<'list' | 'edit' | 'catalog'>(viewOnly ? 'catalog' : 'list');
  const [catalogMode, setCatalogMode] = useState<'leader' | 'main'>('main');
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [decks, setDecks] = useState<DeckData[]>([]);
  const [currentDeck, setCurrentDeck] = useState<DeckData | null>(viewOnly ? { name: 'Catalog', leader_id: null, card_uuids: [], don_uuids: [] } : null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cRes = await fetch(`${API_CONFIG.BASE_URL}/api/cards`);
        const cData = await cRes.json();
        if (cData.success) setAllCards(cData.cards);
        if (!viewOnly) {
          const dRes = await fetch(`${API_CONFIG.BASE_URL}/api/deck/list`);
          const dData = await dRes.json();
          if (dData.success) setDecks(dData.decks);
        }
      } catch (e) { logger.error('deck_builder.init', String(e)); }
    };
    fetchData();
  }, [mode, viewOnly]);

  if (mode === 'list') return <DeckListView decks={decks} onSelectDeck={(d) => { setCurrentDeck(d); setMode('edit'); }} onCreateNew={() => { setCurrentDeck({ name: 'New Deck', leader_id: null, card_uuids: [], don_uuids: [] }); setMode('edit'); }} onBack={onBack} />;
  if (mode === 'edit' && currentDeck) return <DeckEditorView deck={currentDeck} allCards={allCards} onUpdateDeck={setCurrentDeck} onSave={async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/deck`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentDeck) });
      const data = await res.json();
      if (data.success) { alert('保存しました'); setCurrentDeck({...currentDeck, id: data.deck_id}); }
    } catch (e) { alert('エラー'); }
  }} onBack={() => setMode('list')} onOpenCatalog={(m) => { setCatalogMode(m); setMode('catalog'); }} />;
  if (mode === 'catalog' && currentDeck) return <CardCatalogScreen allCards={allCards} mode={catalogMode} currentDeck={currentDeck} onUpdateDeck={setCurrentDeck} onClose={() => viewOnly ? onBack() : setMode('edit')} viewOnly={viewOnly} />;
  return <div>Loading...</div>;
};
