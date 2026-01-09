import React, { useState, useMemo, useEffect } from 'react';
import type { 
  EffectReport, TriggerType, EffectAction, TargetQuery, 
  CardAbility, ActionType
} from '../game/effectReporting';

// --- Types & Interfaces for Component ---

interface Props {
  cardName?: string;
  gameState: any; // GameState型があればそれを使用
  activePlayerId: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

// 簡易カード型（選択用）
interface SimpleCard {
  uuid: string;
  name: string;
  text?: string;
  owner: string;
  zone: string;
}

// 入力待機中のフィールドを識別するためのID
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
  row: {
    display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center', flexWrap: 'wrap' as const
  },
  // スロット風インプットのスタイル
  slotInput: (isActive: boolean, hasValue: boolean) => ({
    background: isActive ? '#3498db' : '#222',
    color: hasValue ? '#fff' : '#7f8c8d',
    border: isActive ? '2px solid #f1c40f' : '1px solid #555',
    padding: '4px 8px', borderRadius: '4px', fontSize: '13px',
    cursor: 'pointer', minWidth: '40px', textAlign: 'center' as const,
    transition: 'all 0.2s'
  }),
  btn: (bg: string) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: '4px',
    padding: '6px 10px', cursor: 'pointer', fontSize: '12px'
  }),
  char: (isSelected: boolean, isUsed: boolean) => ({
    display: 'inline-block', padding: '2px 1px', margin: '0 1px', cursor: 'pointer',
    background: isSelected ? '#e67e22' : isUsed ? '#27ae60' : 'transparent',
    color: isSelected ? 'white' : isUsed ? '#ecf0f1' : '#bdc3c7',
    fontWeight: isSelected || isUsed ? 'bold' as const : 'normal' as const,
    borderBottom: isSelected ? '2px solid white' : 'none',
    opacity: isUsed && !isSelected ? 0.6 : 1
  })
};

// --- Helper Components ---

// 再帰的にアクションを編集するコンポーネント
const ActionEditor: React.FC<{
  action: EffectAction;
  path: string; // 識別用パス (例: "costs-0-then-0")
  activeFieldId: FieldId | null;
  onActivateField: (id: FieldId) => void;
  onChange: (newAction: EffectAction) => void;
  onDelete: () => void;
  depth?: number;
}> = ({ action, path, activeFieldId, onActivateField, onChange, onDelete, depth = 0 }) => {

  const updateField = (field: keyof EffectAction, val: any) => {
    onChange({ ...action, [field]: val });
  };

  const updateTarget = (field: keyof TargetQuery, val: any) => {
    const newTarget = { ...action.target, [field]: val } as TargetQuery;
    if (!newTarget.player) newTarget.player = 'OPPONENT';
    if (!newTarget.zone) newTarget.zone = 'FIELD';
    updateField('target', newTarget);
  };

  // スロット入力コンポーネント（数値・文字列兼用）
  const Slot = ({ fieldKey, val, placeholder, width = '50px' }: { fieldKey: string, val: any, placeholder: string, width?: string }) => {
    const id = `${path}-${fieldKey}`;
    const isActive = activeFieldId === id;
    
    return (
      <div 
        onClick={(e) => { e.stopPropagation(); onActivateField(isActive ? '' : id); }}
        style={{...styles.slotInput(isActive, val !== undefined && val !== null && val !== ''), minWidth: width}}
      >
        {val || placeholder}
      </div>
    );
  };

  return (
    <div style={{ ...styles.section, marginLeft: `${depth * 15}px`, borderLeft: depth > 0 ? '2px solid #f1c40f' : '1px solid #444' }}>
      <div style={styles.row}>
        {depth > 0 && <span style={{fontSize:'12px', color:'#f1c40f'}}>↪ Then: </span>}
        <select value={action.type} onChange={e => updateField('type', e.target.value as ActionType)} style={{...styles.slotInput(false, true), background:'#222'}}>
          <option value="KO">KO</option>
          <option value="REST">REST</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DRAW">DRAW</option>
          <option value="TRASH">TRASH</option>
          <option value="MOVE_TO_HAND">TO HAND</option>
          <option value="ATTACH_DON">ATTACH DON</option>
          <option value="BUFF">BUFF</option>
          <option value="PLAY_CARD">PLAY</option>
          <option value="OTHER">OTHER</option>
        </select>
        
        <Slot fieldKey="value" val={action.value} placeholder="Value" />
        
        <button onClick={onDelete} style={styles.btn('#c0392b')}>×</button>
      </div>

      <div style={{...styles.section, background: 'rgba(255,255,255,0.05)', padding:'5px'}}>
        <div style={styles.row}>
          <span style={{fontSize:'12px', color:'#aaa'}}>Target:</span>
          <select value={action.target?.player || 'OPPONENT'} onChange={e => updateTarget('player', e.target.value)} style={{...styles.slotInput(false, true), background:'#222'}}>
            <option value="SELF">Self</option>
            <option value="OPPONENT">Opp</option>
            <option value="BOTH">Both</option>
          </select>
          <select value={action.target?.zone || 'FIELD'} onChange={e => updateTarget('zone', e.target.value)} style={{...styles.slotInput(false, true), background:'#222'}}>
            <option value="FIELD">Field</option>
            <option value="HAND">Hand</option>
            <option value="TRASH">Trash</option>
            <option value="LIFE">Life</option>
          </select>
          
          <Slot fieldKey="target-count" val={action.target?.count} placeholder="Cnt" width="30px" />
          
          <label style={{color:'white', fontSize:'12px', display:'flex', alignItems:'center', cursor:'pointer'}}>
            <input type="checkbox" checked={action.target?.is_up_to || false} onChange={e => updateTarget('is_up_to', e.target.checked)} /> Up to
          </label>
        </div>
        <div style={styles.row}>
          <Slot fieldKey="target-traits" val={action.target?.traits?.join(',')} placeholder="Traits (特徴)" width="100px" />
        </div>
        <div style={styles.row}>
          <Slot fieldKey="target-cost_max" val={action.target?.cost_max} placeholder="Cost Max" />
          <Slot fieldKey="target-power_min" val={action.target?.power_min} placeholder="Power Min" />
        </div>
      </div>

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
              updateField('then_actions', newThen);
            }}
            onDelete={() => {
              const newThen = action.then_actions?.filter((_, i) => i !== idx);
              updateField('then_actions', newThen);
            }}
          />
        ))}
        <button onClick={() => updateField('then_actions', [...(action.then_actions || []), { type: 'OTHER', value: 0 }])} 
          style={{...styles.btn('#2980b9'), fontSize:'11px', width:'100%', marginTop:'5px'}}>
          + Add 'Then' Action
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---

export const EffectReportForm: React.FC<Props> = ({ cardName = '', gameState, activePlayerId, onSubmit, onCancel }) => {
  // --- State ---
  const [inputCardName, setInputCardName] = useState(cardName);
  const [rawText, setRawText] = useState('');
  
  const [trigger, setTrigger] = useState<TriggerType>('ON_PLAY');
  const [costs, setCosts] = useState<EffectAction[]>([]);
  const [actions, setActions] = useState<EffectAction[]>([]);
  const [note, setNote] = useState('');

  // UI State
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<FieldId | null>(null);
  
  // テキスト選択・使用状態管理
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  // --- Logic ---

  // 数値変換（全角→半角）
  const parseValue = (text: string): number => {
    const normalized = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const num = parseInt(normalized.replace(/[^0-9-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // テキスト注入ハンドラ
  const handleInjectText = () => {
    if (activeFieldId && rangeStart !== null && rawText) {
      const end = rangeEnd !== null ? rangeEnd : rangeStart;
      const selectedText = rawText.slice(rangeStart, end + 1);
      
      // 使用済みインデックスを更新
      const newUsed = new Set(usedIndices);
      for (let i = rangeStart; i <= end; i++) newUsed.add(i);
      setUsedIndices(newUsed);

      // パス解析: "costs-0-value" や "actions-0-then-1-target-count" など
      const parts = activeFieldId.split('-');
      const rootType = parts[0]; // "costs" or "actions"
      const rootIdx = parseInt(parts[1]);
      
      const updateList = (list: EffectAction[], setList: Function) => {
        const newList = JSON.parse(JSON.stringify(list)); // Deep copy
        let current = newList[rootIdx];

        // "then" の階層を掘り進める
        let i = 2;
        while (parts[i] === 'then') {
          const thenIdx = parseInt(parts[i + 1]);
          if (!current.then_actions) current.then_actions = [];
          current = current.then_actions[thenIdx];
          i += 2;
        }

        const fieldKey = parts.slice(i).join('-'); // 残りのパス (value, target-count, target-traits...)
        
        if (fieldKey === 'value') {
          current.value = parseValue(selectedText);
        } else if (fieldKey === 'target-count') {
          if (!current.target) current.target = {};
          current.target.count = parseValue(selectedText);
        } else if (fieldKey === 'target-cost_max') {
          if (!current.target) current.target = {};
          current.target.cost_max = parseValue(selectedText);
        } else if (fieldKey === 'target-power_min') {
          if (!current.target) current.target = {};
          current.target.power_min = parseValue(selectedText);
        } else if (fieldKey === 'target-traits') {
          if (!current.target) current.target = {};
          // 特徴は単純な文字列としてセット（配列変換はsubmit時またはActionEditor内で表示時に処理）
          current.target.traits = [selectedText];
        }

        setList(newList);
      };

      if (rootType === 'costs') updateList(costs, setCosts);
      if (rootType === 'actions') updateList(actions, setActions);

      // リセット
      setRangeStart(null);
      setRangeEnd(null);
      setActiveFieldId(null);
    }
  };

  // テキスト選択ハンドラ
  const handleCharClick = (index: number) => {
    let newStart = rangeStart;
    let newEnd = rangeEnd;

    if (newStart === null || (newStart !== null && newEnd !== null)) {
      newStart = index;
      newEnd = null;
    } else {
      // 範囲確定
      if (index < newStart) {
        newEnd = newStart;
        newStart = index;
      } else {
        newEnd = index;
      }
    }
    setRangeStart(newStart);
    setRangeEnd(newEnd);
  };

  // 選択完了時の自動注入トリガー
  useEffect(() => {
    if (activeFieldId && rangeStart !== null && rangeEnd !== null) {
      handleInjectText();
    }
  }, [rangeStart, rangeEnd]); // activeFieldIdは依存に含めない（フィールド選択前からテキスト選択済みの場合の挙動制御のため）

  // 手動注入ボタン用（1文字選択の場合など）
  const manualInject = () => {
    if (activeFieldId && rangeStart !== null) {
      handleInjectText();
    }
  };

  // カード選択ロジック
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
      setUsedIndices(new Set()); // カードが変わったらリセット
    }
    setShowCardSelector(false);
  };

  // Submit処理
  const handleSubmit = () => {
    // 未使用テキストの抽出
    let unusedParts: string[] = [];
    let currentPart = '';
    
    for (let i = 0; i < rawText.length; i++) {
      if (!usedIndices.has(i)) {
        currentPart += rawText[i];
      } else if (currentPart) {
        unusedParts.push(currentPart);
        currentPart = '';
      }
    }
    if (currentPart) unusedParts.push(currentPart);

    const ability: CardAbility = {
      trigger,
      costs,
      actions,
      raw_text: rawText
    };

    const report: EffectReport = {
      correction: {
        cardName: inputCardName,
        rawText,
        ability,
        unusedTextParts: unusedParts // 未使用部分を追加
      },
      note
    };
    onSubmit(report);
  };

  // --- Render ---

  if (showCardSelector) {
    return (
      <div style={styles.container}>
        <div style={{...styles.form, padding: '10px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
            <h3>🃏 対象カードを選択</h3>
            <button onClick={() => setShowCardSelector(false)} style={styles.btn('#95a5a6')}>閉じる</button>
          </div>
          <div style={{...styles.scrollArea, padding: 0}}>
            {visibleCards.map((c, idx) => (
              <div key={`${c.uuid}-${idx}`} onClick={() => handleSelectCard(c)} 
                style={{padding: '12px', borderBottom: '1px solid #555', cursor: 'pointer', background: inputCardName === c.name ? '#2980b9' : 'transparent'}}>
                <div style={{fontWeight: 'bold'}}>{c.name}</div>
                <div style={{fontSize: '0.8em', color: '#bdc3c7'}}>[{c.owner}] {c.zone}</div>
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
        <div style={{ padding: '10px 15px', background: '#2c3e50', borderBottom: '1px solid #7f8c8d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>🛠 詳細効果入力</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#bdc3c7', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={styles.scrollArea}>
          {/* テキスト表示エリア */}
          <div style={{...styles.section, position: 'sticky', top: 0, zIndex: 100, background: '#2c3e50', borderBottom: '2px solid #f1c40f', boxShadow: '0 4px 10px rgba(0,0,0,0.5)'}}>
             <div style={{display: 'flex', gap: '8px', marginBottom: '5px'}}>
              <input value={inputCardName} readOnly placeholder="カード未選択" style={{background: 'transparent', border:'none', color:'white', fontWeight:'bold', flex:1}} />
              <button onClick={() => setShowCardSelector(true)} style={styles.btn('#e67e22')}>カード選択</button>
            </div>
            
            <div style={{
              background: '#202020', padding: '10px', borderRadius: '6px', 
              fontFamily: 'monospace', fontSize: '16px', lineHeight: '2.2',
              minHeight: '60px', whiteSpace: 'pre-wrap', border: '1px solid #555'
            }}>
              {rawText ? rawText.split('').map((char, idx) => {
                const isSelected = rangeStart !== null && (rangeEnd !== null 
                  ? (idx >= rangeStart && idx <= rangeEnd)
                  : (idx === rangeStart));
                const isUsed = usedIndices.has(idx);
                
                return (
                  <span 
                    key={idx}
                    onClick={() => handleCharClick(idx)}
                    style={styles.char(isSelected, isUsed)}
                  >
                    {char}
                  </span>
                );
              }) : <span style={{color: '#7f8c8d'}}>カードを選択してください</span>}
            </div>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'5px', minHeight:'20px'}}>
              <div style={{fontSize:'12px', color: activeFieldId ? '#f1c40f' : '#7f8c8d'}}>
                 {activeFieldId ? `以下の青枠部分に入力中...` : '下の枠をクリックして入力先を選択'}
              </div>
              {activeFieldId && rangeStart !== null && rangeEnd === null && (
                <button onClick={manualInject} style={styles.btn('#2980b9')}>この1文字を入力</button>
              )}
            </div>
          </div>

          {/* Trigger */}
          <div style={styles.section}>
            <span style={{...styles.row, fontWeight:'bold'}}>Trigger (いつ発動するか)</span>
            <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} style={{...styles.slotInput(false, true), width:'100%', textAlign:'left'}}>
              <option value="ON_PLAY">ON_PLAY (登場時)</option>
              <option value="ON_ATTACK">ON_ATTACK (アタック時)</option>
              <option value="ACTIVATE_MAIN">ACTIVATE_MAIN (起動メイン)</option>
              <option value="ON_KO">ON_KO (KO時)</option>
              <option value="ON_BLOCK">ON_BLOCK (ブロック時)</option>
              <option value="TURN_END">TURN_END (ターン終了時)</option>
              <option value="OPP_TURN_END">OPP_TURN_END (相手ターン終了時)</option>
              <option value="TRIGGER">TRIGGER (トリガー)</option>
            </select>
          </div>

          {/* Costs */}
          <div style={styles.section}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              <span style={{fontWeight:'bold'}}>Costs (コスト)</span>
              <button onClick={() => setCosts([...costs, { type: 'OTHER', value: 0 }])} style={styles.btn('#7f8c8d')}>+ Add Cost</button>
            </div>
            {costs.map((c, i) => (
              <ActionEditor 
                key={i} 
                action={c} 
                path={`costs-${i}`}
                activeFieldId={activeFieldId}
                onActivateField={setActiveFieldId}
                onChange={val => { const n = [...costs]; n[i] = val; setCosts(n); }}
                onDelete={() => setCosts(costs.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={styles.section}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              <span style={{fontWeight:'bold'}}>Actions (効果)</span>
              <button onClick={() => setActions([...actions, { type: 'OTHER', value: 0 }])} style={styles.btn('#27ae60')}>+ Add Action</button>
            </div>
            {actions.map((a, i) => (
              <ActionEditor 
                key={i} 
                action={a} 
                path={`actions-${i}`}
                activeFieldId={activeFieldId}
                onActivateField={setActiveFieldId}
                onChange={val => { const n = [...actions]; n[i] = val; setActions(n); }}
                onDelete={() => setActions(actions.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
          
          <div style={styles.section}>
             <span style={{fontSize:'12px', color:'#aaa'}}>Note / 補足</span>
             <textarea value={note} onChange={e => setNote(e.target.value)} style={{width:'100%', height:'50px', background:'#222', color:'white', border:'1px solid #555'}} />
          </div>
        </div>

        <div style={{ padding: '15px', background: '#2c3e50', borderTop: '1px solid #7f8c8d', display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{...styles.btn('#95a5a6'), flex: 1, padding: '12px', fontSize:'16px'}}>キャンセル</button>
          <button onClick={handleSubmit} style={{...styles.btn('#e67e22'), flex: 1, padding: '12px', fontSize:'16px'}}>報告送信</button>
        </div>
      </div>
    </div>
  );
};
