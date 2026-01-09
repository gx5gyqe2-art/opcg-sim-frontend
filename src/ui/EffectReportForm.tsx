import React, { useState, useMemo, useEffect } from 'react';
import type { 
  EffectReport, TriggerType, EffectAction, TargetQuery, 
  CardAbility, ActionType, Condition, ConditionType, CompareOperator, Zone, PlayerType
} from '../game/effectReporting';

// --- Types & Interfaces ---

interface Props {
  cardName?: string;
  gameState: any;
  activePlayerId: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

interface SimpleCard {
  uuid: string;
  name: string;
  text?: string;
  owner: string;
  zone: string;
}

// Field ID for slot injection
type FieldId = string;

// --- Styles ---
const styles = {
  container: {
    position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  },
  form: {
    width: '100%', height: '100%', backgroundColor: '#2c3e50', color: '#ecf0f1',
    display: 'flex', flexDirection: 'column' as const, boxSizing: 'border-box' as const
  },
  scrollArea: {
    flex: 1, overflowY: 'auto' as const, padding: '15px', paddingBottom: '120px'
  },
  section: {
    marginBottom: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)',
    borderRadius: '4px', border: '1px solid #444'
  },
  subSection: {
    marginTop: '5px', padding: '8px', background: 'rgba(255,255,255,0.03)',
    borderRadius: '4px', borderLeft: '2px solid #7f8c8d'
  },
  row: {
    display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' as const
  },
  slotInput: (isActive: boolean, hasValue: boolean) => ({
    background: isActive ? '#3498db' : '#222',
    color: hasValue ? '#fff' : '#7f8c8d',
    border: isActive ? '2px solid #f1c40f' : '1px solid #555',
    padding: '4px 8px', borderRadius: '4px', fontSize: '13px',
    cursor: 'pointer', minWidth: '40px', textAlign: 'center' as const,
    transition: 'all 0.2s', display: 'inline-block'
  }),
  btn: (bg: string) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: '4px',
    padding: '4px 8px', cursor: 'pointer', fontSize: '12px'
  }),
  char: (isSelected: boolean, isUsed: boolean) => ({
    display: 'inline-block', padding: '2px 1px', margin: '0 1px', cursor: 'pointer',
    background: isSelected ? '#e67e22' : isUsed ? '#27ae60' : 'transparent',
    color: isSelected ? 'white' : isUsed ? '#ecf0f1' : '#bdc3c7',
    fontWeight: isSelected || isUsed ? 'bold' as const : 'normal' as const,
    borderBottom: isSelected ? '2px solid white' : 'none',
    opacity: isUsed && !isSelected ? 0.6 : 1
  }),
  label: { fontSize: '11px', color: '#aaa', marginRight: '4px' }
};

// --- Helper Components ---

const Slot = ({ id, val, placeholder, width = '50px', activeFieldId, onActivate }: any) => {
  const isActive = activeFieldId === id;
  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onActivate(isActive ? '' : id); }}
      style={{...styles.slotInput(isActive, val !== undefined && val !== null && val !== ''), minWidth: width}}
      title={id}
    >
      {val !== undefined && val !== null && val !== '' ? String(val) : placeholder}
    </div>
  );
};

// --- Sub-Editors ---

const TargetEditor: React.FC<{
  target: TargetQuery;
  path: string;
  activeFieldId: FieldId | null;
  onActivate: (id: FieldId) => void;
  onChange: (t: TargetQuery) => void;
}> = ({ target, path, activeFieldId, onActivate, onChange }) => {
  const update = (k: keyof TargetQuery, v: any) => onChange({ ...target, [k]: v });
  
  // 文字列配列をカンマ区切り文字列として扱う
  const listToString = (list?: string[]) => list?.join(',') || '';
  const stringToList = (str: string) => str.split(',').map(s => s.trim()).filter(s => s);

  return (
    <div style={styles.subSection}>
      <div style={styles.row}>
        <span style={{fontWeight:'bold', fontSize:'12px', color:'#f39c12'}}>TARGET</span>
        <select value={target.zone} onChange={e => update('zone', e.target.value as Zone)} style={{...styles.slotInput(false, true), background:'#333'}}>
          <option value="FIELD">FIELD</option><option value="HAND">HAND</option>
          <option value="TRASH">TRASH</option><option value="LIFE">LIFE</option>
          <option value="DECK">DECK</option><option value="ANY">ANY</option>
        </select>
        <select value={target.player} onChange={e => update('player', e.target.value as PlayerType)} style={{...styles.slotInput(false, true), background:'#333'}}>
          <option value="OPPONENT">OPP</option><option value="SELF">SELF</option>
          <option value="BOTH">BOTH</option><option value="OWNER">OWNER</option>
        </select>
        <Slot id={`${path}-count`} val={target.count} placeholder="Cnt" width="30px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <label><input type="checkbox" checked={target.is_up_to} onChange={e => update('is_up_to', e.target.checked)} /> UpTo</label>
        
        <Slot id={`${path}-select_mode`} val={target.select_mode} placeholder="Mode(CHOOSE)" width="60px" activeFieldId={activeFieldId} onActivate={onActivate} />
      </div>
      
      <div style={styles.row}>
        <span style={styles.label}>Filters:</span>
        <Slot id={`${path}-traits`} val={listToString(target.traits)} placeholder="Traits" width="80px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-names`} val={listToString(target.names)} placeholder="Names" width="80px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-attributes`} val={listToString(target.attributes)} placeholder="Attr" width="50px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-colors`} val={listToString(target.colors)} placeholder="Colors" width="50px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-card_type`} val={listToString(target.card_type)} placeholder="Types" width="50px" activeFieldId={activeFieldId} onActivate={onActivate} />
      </div>

      <div style={styles.row}>
        <span style={styles.label}>Ranges:</span>
        <Slot id={`${path}-cost_min`} val={target.cost_min} placeholder="C-Min" width="40px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-cost_max`} val={target.cost_max} placeholder="C-Max" width="40px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-power_min`} val={target.power_min} placeholder="P-Min" width="40px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <Slot id={`${path}-power_max`} val={target.power_max} placeholder="P-Max" width="40px" activeFieldId={activeFieldId} onActivate={onActivate} />
        <select value={String(target.is_rest)} onChange={e => update('is_rest', e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined)} style={{...styles.slotInput(false, true), background:'#333'}}>
           <option value="undefined">Any State</option><option value="true">Rest</option><option value="false">Active</option>
        </select>
      </div>
    </div>
  );
};

const ConditionEditor: React.FC<{
  condition: Condition;
  path: string;
  activeFieldId: FieldId | null;
  onActivate: (id: FieldId) => void;
  onChange: (c: Condition) => void;
  onDelete: () => void;
}> = ({ condition, path, activeFieldId, onActivate, onChange, onDelete }) => {
  const update = (k: keyof Condition, v: any) => onChange({ ...condition, [k]: v });

  return (
    <div style={{...styles.subSection, borderLeft: '2px solid #e74c3c'}}>
      <div style={{...styles.row, justifyContent:'space-between'}}>
        <span style={{fontWeight:'bold', fontSize:'12px', color:'#e74c3c'}}>CONDITION</span>
        <button onClick={onDelete} style={styles.btn('#c0392b')}>Del</button>
      </div>
      <div style={styles.row}>
        <select value={condition.type} onChange={e => update('type', e.target.value)} style={{...styles.slotInput(false, true), background:'#333', maxWidth:'120px'}}>
           <option value="LIFE_COUNT">LIFE_COUNT</option><option value="HAND_COUNT">HAND_COUNT</option>
           <option value="FIELD_COUNT">FIELD_COUNT</option><option value="TRASH_COUNT">TRASH_COUNT</option>
           <option value="DON_COUNT">DON_COUNT</option><option value="HAS_TRAIT">HAS_TRAIT</option>
           <option value="IS_RESTED">IS_RESTED</option><option value="LEADER_NAME">LEADER_NAME</option>
           <option value="OTHER">OTHER</option>
        </select>
        <select value={condition.operator} onChange={e => update('operator', e.target.value)} style={{...styles.slotInput(false, true), background:'#333'}}>
           <option value="EQ">==</option><option value="GE">{'>='}</option><option value="LE">{'<='}</option>
           <option value="GT">{'>'}</option><option value="LT">{'<'}</option><option value="HAS">HAS</option>
        </select>
        <Slot id={`${path}-value`} val={condition.value} placeholder="Value" activeFieldId={activeFieldId} onActivate={onActivate} />
      </div>
      
      <div style={{marginTop:'5px'}}>
        <label style={{fontSize:'12px', color:'#aaa'}}>
          <input type="checkbox" checked={!!condition.target} 
             onChange={e => update('target', e.target.checked ? { zone: 'FIELD', player: 'SELF', count: 1, is_up_to: false } : undefined)} /> 
          Use Target Check?
        </label>
        {condition.target && (
          <TargetEditor 
            target={condition.target} 
            path={`${path}-target`} 
            activeFieldId={activeFieldId} 
            onActivate={onActivate} 
            onChange={t => update('target', t)} 
          />
        )}
      </div>
    </div>
  );
};

const DetailsEditor: React.FC<{
  details: Record<string, any>;
  path: string;
  activeFieldId: FieldId | null;
  onActivate: (id: FieldId) => void;
  onChange: (d: Record<string, any>) => void;
}> = ({ details, path, activeFieldId, onActivate, onChange }) => {
  const [newKey, setNewKey] = useState('');
  
  const handleAdd = () => {
    if (newKey) {
      onChange({ ...details, [newKey]: '' });
      setNewKey('');
    }
  };

  const handleUpdate = (key: string, val: string) => {
    onChange({ ...details, [key]: val });
  };

  const handleRemove = (key: string) => {
    const next = { ...details };
    delete next[key];
    onChange(next);
  };

  return (
    <div style={styles.subSection}>
      <div style={{fontWeight:'bold', fontSize:'12px', color:'#9b59b6', marginBottom:'5px'}}>DETAILS (Dict)</div>
      {Object.entries(details).map(([k, v]) => (
        <div key={k} style={styles.row}>
          <span style={{fontSize:'12px', color:'#ccc', width:'60px', overflow:'hidden'}}>{k}:</span>
          <Slot id={`${path}-${k}`} val={v} placeholder="Value" width="80px" activeFieldId={activeFieldId} onActivate={onActivate} />
          <button onClick={() => handleRemove(k)} style={{...styles.btn('#c0392b'), padding:'0 4px', fontSize:'10px'}}>x</button>
        </div>
      ))}
      <div style={styles.row}>
        <input placeholder="New Key" value={newKey} onChange={e => setNewKey(e.target.value)} style={{background:'#222', border:'1px solid #555', color:'white', width:'60px', fontSize:'12px'}} />
        <button onClick={handleAdd} style={styles.btn('#9b59b6')}>Add</button>
      </div>
    </div>
  );
};


const ActionEditor: React.FC<{
  action: EffectAction;
  path: string;
  activeFieldId: FieldId | null;
  onActivateField: (id: FieldId) => void;
  onChange: (newAction: EffectAction) => void;
  onDelete: () => void;
  depth?: number;
}> = ({ action, path, activeFieldId, onActivateField, onChange, onDelete, depth = 0 }) => {

  const update = (field: keyof EffectAction, val: any) => onChange({ ...action, [field]: val });

  return (
    <div style={{ ...styles.section, marginLeft: `${depth * 10}px`, borderLeft: depth > 0 ? '2px solid #f1c40f' : '1px solid #444', padding:'5px' }}>
      
      {/* HEADER: Type, Value, Zones */}
      <div style={styles.row}>
        {depth > 0 && <span style={{fontSize:'12px', color:'#f1c40f'}}>↪ Then: </span>}
        
        <select value={action.type} onChange={e => update('type', e.target.value as ActionType)} style={{...styles.slotInput(false, true), background:'#222'}}>
          <option value="KO">KO</option><option value="REST">REST</option><option value="ACTIVE">ACTIVE</option>
          <option value="DRAW">DRAW</option><option value="TRASH">TRASH</option><option value="PLAY_CARD">PLAY</option>
          <option value="BUFF">BUFF</option><option value="ATTACH_DON">ATTACH_DON</option>
          <option value="MOVE_TO_HAND">TO_HAND</option><option value="DECK_BOTTOM">DECK_BOT</option>
          <option value="OTHER">OTHER</option>
        </select>
        
        <Slot id={`${path}-value`} val={action.value} placeholder="Val" width="40px" activeFieldId={activeFieldId} onActivate={onActivateField} />
        
        <select value={action.subject} onChange={e => update('subject', e.target.value)} style={{...styles.slotInput(false, true), background:'#222', fontSize:'11px'}}>
          <option value="SELF">By: SELF</option><option value="OPPONENT">By: OPP</option>
        </select>

        <button onClick={onDelete} style={styles.btn('#c0392b')}>×</button>
      </div>

      <div style={{...styles.row, fontSize:'11px', color:'#aaa'}}>
         <span>From:</span>
         <select value={action.source_zone} onChange={e => update('source_zone', e.target.value)} style={{background:'#222', color:'white', border:'none'}}>
            <option value="ANY">ANY</option><option value="FIELD">FIELD</option><option value="HAND">HAND</option><option value="TRASH">TRASH</option>
         </select>
         <span>To:</span>
         <select value={action.dest_zone} onChange={e => update('dest_zone', e.target.value)} style={{background:'#222', color:'white', border:'none'}}>
            <option value="ANY">ANY</option><option value="FIELD">FIELD</option><option value="HAND">HAND</option><option value="TRASH">TRASH</option>
         </select>
         <input value={action.dest_position} onChange={e => update('dest_position', e.target.value)} placeholder="Pos(BOTTOM)" style={{width:'50px', background:'#222', color:'white', border:'none'}}/>
      </div>

      {/* Toggles for sub-structures */}
      <div style={styles.row}>
         <label style={{fontSize:'11px', color:'white', marginRight:'8px'}}>
           <input type="checkbox" checked={!!action.target} 
             onChange={e => update('target', e.target.checked ? { zone: 'FIELD', player: 'OPPONENT', count: 1, is_up_to: false } : undefined)} /> Target
         </label>
         <label style={{fontSize:'11px', color:'white', marginRight:'8px'}}>
           <input type="checkbox" checked={!!action.condition} 
             onChange={e => update('condition', e.target.checked ? { type: 'NONE', operator: 'EQ', value: 0 } : undefined)} /> Cond
         </label>
         <label style={{fontSize:'11px', color:'white'}}>
           <input type="checkbox" checked={!!action.details} 
             onChange={e => update('details', e.target.checked ? {} : undefined)} /> Details
         </label>
      </div>

      {/* Sub-Editors */}
      {action.target && (
        <TargetEditor 
          target={action.target} 
          path={`${path}-target`} 
          activeFieldId={activeFieldId} 
          onActivate={onActivateField} 
          onChange={t => update('target', t)} 
        />
      )}

      {action.condition && (
        <ConditionEditor 
          condition={action.condition} 
          path={`${path}-condition`} 
          activeFieldId={activeFieldId} 
          onActivate={onActivateField} 
          onChange={c => update('condition', c)} 
          onDelete={() => update('condition', undefined)}
        />
      )}

      {action.details && (
        <DetailsEditor 
          details={action.details} 
          path={`${path}-details`} 
          activeFieldId={activeFieldId} 
          onActivate={onActivateField} 
          onChange={d => update('details', d)} 
        />
      )}

      {/* Recursion */}
      <div>
        {action.then_actions?.map((subAction, idx) => (
          <ActionEditor
            key={idx}
            depth={depth + 1}
            path={`${path}-then-${idx}`}
            activeFieldId={activeFieldId}
            onActivateField={onActivateField}
            action={subAction}
            onChange={(newVal) => {
              const newThen = [...(action.then_actions || [])];
              newThen[idx] = newVal;
              update('then_actions', newThen);
            }}
            onDelete={() => {
              const newThen = action.then_actions?.filter((_, i) => i !== idx);
              update('then_actions', newThen);
            }}
          />
        ))}
        <button onClick={() => update('then_actions', [...(action.then_actions || []), { type: 'OTHER', value: 0, subject: 'SELF', source_zone: 'ANY', dest_zone: 'ANY', dest_position: 'BOTTOM' }])} 
          style={{...styles.btn('#2980b9'), fontSize:'11px', width:'100%', marginTop:'5px'}}>
          + Add 'Then' Action
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---

export const EffectReportForm: React.FC<Props> = ({ cardName = '', gameState, activePlayerId, onSubmit, onCancel }) => {
  const [inputCardName, setInputCardName] = useState(cardName);
  const [rawText, setRawText] = useState('');
  
  const [trigger, setTrigger] = useState<TriggerType>('ON_PLAY');
  const [costs, setCosts] = useState<EffectAction[]>([]);
  const [actions, setActions] = useState<EffectAction[]>([]);
  const [note, setNote] = useState('');

  const [showCardSelector, setShowCardSelector] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<FieldId | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  // ... (以下、テキスト選択・注入ロジックは前のバージョンと同じため省略せず記述) ...

  const parseValue = (text: string): number => {
    const normalized = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const num = parseInt(normalized.replace(/[^0-9-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const createDefaultAction = (): EffectAction => ({
    type: 'OTHER', value: 0, subject: 'SELF',
    source_zone: 'ANY', dest_zone: 'ANY', dest_position: 'BOTTOM'
  });

  const handleInjectText = () => {
    if (activeFieldId && rangeStart !== null && rawText) {
      const end = rangeEnd !== null ? rangeEnd : rangeStart;
      const selectedText = rawText.slice(rangeStart, end + 1);
      
      const newUsed = new Set(usedIndices);
      for (let i = rangeStart; i <= end; i++) newUsed.add(i);
      setUsedIndices(newUsed);

      const parts = activeFieldId.split('-');
      // ID Format: "costs-0-then-1-target-count" etc.
      const rootType = parts[0]; 
      const rootIdx = parseInt(parts[1]);
      
      const updateList = (list: EffectAction[], setList: Function) => {
        const newList = JSON.parse(JSON.stringify(list));
        let current = newList[rootIdx];

        // Navigate "then" actions
        let i = 2;
        while (parts[i] === 'then') {
          current = current.then_actions[parseInt(parts[i + 1])];
          i += 2;
        }

        const remainingParts = parts.slice(i);
        const subObj = remainingParts[0]; // target, condition, details, or direct field
        const fieldKey = remainingParts[remainingParts.length - 1]; // last part is key

        // Helper to update deeply nested objects
        if (subObj === 'target') {
            if (!current.target) current.target = { zone: 'FIELD', player: 'OPPONENT', count: 1 };
            if (fieldKey === 'traits' || fieldKey === 'names' || fieldKey === 'attributes' || fieldKey === 'colors' || fieldKey === 'card_type') {
                 // Append to array
                 const arr = current.target[fieldKey] || [];
                 arr.push(selectedText);
                 current.target[fieldKey] = arr;
            } else if (['cost_min','cost_max','power_min','power_max','count'].includes(fieldKey)) {
                 current.target[fieldKey] = parseValue(selectedText);
            } else {
                 current.target[fieldKey] = selectedText;
            }
        } else if (subObj === 'condition') {
            if (!current.condition) current.condition = { type: 'NONE', operator: 'EQ', value: 0 };
            if (remainingParts[1] === 'target') {
                 // Condition has nested target
                 const condTargetKey = remainingParts[remainingParts.length - 1];
                 if (!current.condition.target) current.condition.target = { zone: 'FIELD' };
                 // ... similiar logic for condition target ...
                 if (['traits','names'].includes(condTargetKey)) {
                    const arr = current.condition.target[condTargetKey] || [];
                    arr.push(selectedText);
                    current.condition.target[condTargetKey] = arr;
                 } else {
                    current.condition.target[condTargetKey] = selectedText; // simplified
                 }
            } else if (fieldKey === 'value') {
                 // Try parsing number, fallback string
                 const num = parseValue(selectedText);
                 current.condition.value = (num !== 0 || selectedText === '0') ? num : selectedText;
            } else {
                 current.condition[fieldKey] = selectedText;
            }
        } else if (subObj === 'details') {
            if (!current.details) current.details = {};
            current.details[fieldKey] = selectedText;
        } else {
            // Direct field on Action
            if (fieldKey === 'value') current.value = parseValue(selectedText);
            else current[fieldKey] = selectedText;
        }

        setList(newList);
      };

      if (rootType === 'costs') updateList(costs, setCosts);
      if (rootType === 'actions') updateList(actions, setActions);

      setRangeStart(null);
      setRangeEnd(null);
      setActiveFieldId(null);
    }
  };

  useEffect(() => {
    if (activeFieldId && rangeStart !== null && rangeEnd !== null) handleInjectText();
  }, [rangeStart, rangeEnd]);

  // Card Selector Logic (Same as before)
  const visibleCards = useMemo(() => {
    if (!gameState) return [];
    const cards: SimpleCard[] = [];
    const processPlayer = (pid: string, pData: any) => {
      const ownerLabel = pid === activePlayerId ? '自分' : '相手';
      if (pData.leader) cards.push({ uuid: pData.leader.uuid, name: pData.leader.name, text: pData.leader.text, owner: ownerLabel, zone: 'リーダー' });
      pData.zones.field.forEach((c: any) => cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: '盤面' }));
      pData.zones.hand.forEach((c: any) => cards.push({ uuid: c.uuid, name: c.name, text: c.text, owner: ownerLabel, zone: '手札' }));
    };
    if (gameState.players.p1) processPlayer('p1', gameState.players.p1);
    if (gameState.players.p2) processPlayer('p2', gameState.players.p2);
    return cards;
  }, [gameState, activePlayerId]);

  const handleSelectCard = (card: SimpleCard) => {
    setInputCardName(card.name);
    if (card.text) {
      setRawText(card.text);
      setUsedIndices(new Set());
    }
    setShowCardSelector(false);
  };

  const handleSubmit = () => {
    let unusedParts: string[] = [];
    let currentPart = '';
    for (let i = 0; i < rawText.length; i++) {
      if (!usedIndices.has(i)) currentPart += rawText[i];
      else if (currentPart) { unusedParts.push(currentPart); currentPart = ''; }
    }
    if (currentPart) unusedParts.push(currentPart);

    const ability: CardAbility = { trigger, costs, actions, raw_text: rawText };
    onSubmit({ correction: { cardName: inputCardName, rawText, ability, unusedTextParts: unusedParts }, note });
  };

  // --- Render ---

  if (showCardSelector) {
    return (
      <div style={styles.container}>
        <div style={{...styles.form, padding: '10px'}}>
           {/* Card Selector UI (Simplified) */}
           <button onClick={() => setShowCardSelector(false)} style={styles.btn('#95a5a6')}>Close</button>
           <div style={{...styles.scrollArea}}>
              {visibleCards.map((c, i) => (
                 <div key={i} onClick={() => handleSelectCard(c)} style={{padding:'10px', borderBottom:'1px solid #555'}}>
                    {c.name} <span style={{color:'#aaa'}}>{c.zone}</span>
                 </div>
              ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.form}>
        <div style={{ padding: '10px', background: '#2c3e50', borderBottom: '1px solid #7f8c8d', display: 'flex', justifyContent: 'space-between' }}>
          <h3>🛠 Ultimate Effect Builder</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#ccc', fontSize: '20px' }}>×</button>
        </div>

        <div style={styles.scrollArea}>
          {/* Text Area */}
          <div style={{...styles.section, position: 'sticky', top: 0, zIndex: 100, background: '#2c3e50', borderBottom: '2px solid #f1c40f'}}>
            <div style={{display: 'flex', gap: '8px', marginBottom: '5px'}}>
              <input value={inputCardName} readOnly placeholder="Card Name" style={{background:'transparent', border:'none', color:'white', flex:1}} />
              <button onClick={() => setShowCardSelector(true)} style={styles.btn('#e67e22')}>Select Card</button>
            </div>
            <div style={{background: '#202020', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', lineHeight: '2.2', whiteSpace: 'pre-wrap', border: '1px solid #555'}}>
              {rawText ? rawText.split('').map((char, idx) => (
                <span key={idx} onClick={() => {
                   let s = rangeStart === null ? idx : (idx < rangeStart ? idx : rangeStart);
                   let e = rangeStart === null ? null : (idx < rangeStart ? rangeStart : idx);
                   if (rangeStart !== null && rangeEnd !== null) { s = idx; e = null; }
                   setRangeStart(s); setRangeEnd(e);
                }} style={styles.char(rangeStart !== null && (rangeEnd !== null ? (idx >= rangeStart && idx <= rangeEnd) : idx === rangeStart), usedIndices.has(idx))}>{char}</span>
              )) : <span style={{color:'#7f8c8d'}}>No text loaded</span>}
            </div>
            <div style={{fontSize:'12px', color: activeFieldId ? '#f1c40f' : '#7f8c8d', marginTop:'5px'}}>
               {activeFieldId ? `Inputting to: ${activeFieldId}` : 'Click a box below to start input'}
            </div>
          </div>

          <div style={styles.section}>
             <span style={{fontWeight:'bold'}}>Trigger: </span>
             <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} style={{background:'#222', color:'white', border:'1px solid #555'}}>
                <option value="ON_PLAY">ON_PLAY</option><option value="ON_ATTACK">ON_ATTACK</option>
                <option value="ACTIVATE_MAIN">ACTIVATE_MAIN</option><option value="ON_KO">ON_KO</option>
                <option value="TURN_END">TURN_END</option><option value="TRIGGER">TRIGGER</option>
             </select>
          </div>

          <div style={styles.section}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
               <span style={{fontWeight:'bold'}}>Costs</span>
               <button onClick={() => setCosts([...costs, createDefaultAction()])} style={styles.btn('#7f8c8d')}>+</button>
            </div>
            {costs.map((c, i) => (
              <ActionEditor key={i} action={c} path={`costs-${i}`} activeFieldId={activeFieldId} onActivateField={setActiveFieldId}
                onChange={v => {const n=[...costs]; n[i]=v; setCosts(n)}} onDelete={() => setCosts(costs.filter((_,x)=>x!==i))} />
            ))}
          </div>

          <div style={styles.section}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
               <span style={{fontWeight:'bold'}}>Actions</span>
               <button onClick={() => setActions([...actions, createDefaultAction()])} style={styles.btn('#27ae60')}>+</button>
            </div>
            {actions.map((a, i) => (
              <ActionEditor key={i} action={a} path={`actions-${i}`} activeFieldId={activeFieldId} onActivateField={setActiveFieldId}
                onChange={v => {const n=[...actions]; n[i]=v; setActions(n)}} onDelete={() => setActions(actions.filter((_,x)=>x!==i))} />
            ))}
          </div>
          
          <div style={styles.section}>
             <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notes..." style={{width:'100%', background:'#222', color:'white'}} />
          </div>
        </div>

        <div style={{ padding: '10px', background: '#2c3e50', borderTop: '1px solid #7f8c8d', display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{...styles.btn('#95a5a6'), flex:1, padding:'10px'}}>Cancel</button>
          <button onClick={handleSubmit} style={{...styles.btn('#e67e22'), flex:1, padding:'10px'}}>Submit</button>
        </div>
      </div>
    </div>
  );
};
