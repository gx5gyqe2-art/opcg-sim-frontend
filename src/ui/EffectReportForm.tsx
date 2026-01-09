import React, { useState } from 'react';
import type { 
  EffectReport, TriggerType, EffectAction, TargetQuery, 
  CardAbility, ActionType
} from '../game/effectReporting';

interface Props {
  cardName?: string;
  gameState: any;
  activePlayerId: string;
  onSubmit: (report: EffectReport) => void;
  onCancel: () => void;
}

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
  input: {
    background: '#222', color: '#fff', border: '1px solid #555',
    padding: '4px', borderRadius: '4px', fontSize: '13px'
  },
  label: {
    color: '#aaa', fontSize: '12px', marginRight: '5px', minWidth: '60px'
  },
  btn: (bg: string) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: '4px',
    padding: '6px 10px', cursor: 'pointer', fontSize: '12px'
  })
};

const ActionEditor: React.FC<{
  action: EffectAction;
  onChange: (newAction: EffectAction) => void;
  onDelete: () => void;
  depth?: number;
}> = ({ action, onChange, onDelete, depth = 0 }) => {
  const updateField = (field: keyof EffectAction, val: any) => {
    onChange({ ...action, [field]: val });
  };

  const updateTarget = (field: keyof TargetQuery, val: any) => {
    const newTarget = { ...action.target, [field]: val } as TargetQuery;
    if (!newTarget.player) newTarget.player = 'OPPONENT';
    if (!newTarget.zone) newTarget.zone = 'FIELD';
    updateField('target', newTarget);
  };

  const addThenAction = () => {
    const currentThen = action.then_actions || [];
    updateField('then_actions', [...currentThen, { type: 'OTHER', value: 0 }]);
  };

  return (
    <div style={{ ...styles.section, marginLeft: `${depth * 15}px`, borderLeft: depth > 0 ? '2px solid #f1c40f' : '1px solid #444' }}>
      <div style={styles.row}>
        {depth > 0 && <span style={{fontSize:'12px', color:'#f1c40f'}}>↪ Then: </span>}
        <select value={action.type} onChange={e => updateField('type', e.target.value as ActionType)} style={styles.input}>
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
        
        <input 
          type="number" 
          placeholder="Value"
          value={action.value || ''} 
          onChange={e => updateField('value', parseInt(e.target.value) || 0)}
          style={{...styles.input, width: '50px'}}
        />
        
        <button onClick={onDelete} style={styles.btn('#c0392b')}>×</button>
      </div>

      <div style={{...styles.section, background: 'rgba(255,255,255,0.05)', padding:'5px'}}>
        <div style={styles.row}>
          <span style={styles.label}>Target:</span>
          <select value={action.target?.player || 'OPPONENT'} onChange={e => updateTarget('player', e.target.value)} style={styles.input}>
            <option value="SELF">Self</option>
            <option value="OPPONENT">Opp</option>
            <option value="BOTH">Both</option>
          </select>
          <select value={action.target?.zone || 'FIELD'} onChange={e => updateTarget('zone', e.target.value)} style={styles.input}>
            <option value="FIELD">Field</option>
            <option value="HAND">Hand</option>
            <option value="TRASH">Trash</option>
            <option value="LIFE">Life</option>
          </select>
          <input placeholder="Count" type="number" value={action.target?.count ?? 1} onChange={e => updateTarget('count', parseInt(e.target.value))} style={{...styles.input, width:'40px'}} />
          <label style={{color:'white', fontSize:'12px', display:'flex', alignItems:'center'}}>
            <input type="checkbox" checked={action.target?.is_up_to || false} onChange={e => updateTarget('is_up_to', e.target.checked)} /> Up to
          </label>
        </div>
        <div style={styles.row}>
          <input placeholder="Traits (comma sep)" value={action.target?.traits?.join(',') || ''} onChange={e => updateTarget('traits', e.target.value.split(','))} style={{...styles.input, flex:1}} />
        </div>
        <div style={styles.row}>
          <input placeholder="Cost Max" type="number" value={action.target?.cost_max || ''} onChange={e => updateTarget('cost_max', parseInt(e.target.value))} style={{...styles.input, width:'60px'}} />
          <input placeholder="Power Min" type="number" value={action.target?.power_min || ''} onChange={e => updateTarget('power_min', parseInt(e.target.value))} style={{...styles.input, width:'60px'}} />
        </div>
      </div>

      <div>
        {action.then_actions?.map((subAction, idx) => (
          <ActionEditor
            key={idx}
            depth={depth + 1}
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
        <button onClick={addThenAction} style={{...styles.btn('#2980b9'), fontSize:'11px', width:'100%', marginTop:'5px'}}>+ Add 'Then' Action</button>
      </div>
    </div>
  );
};

export const EffectReportForm: React.FC<Props> = ({ cardName = '', onSubmit, onCancel }) => {
  const [trigger, setTrigger] = useState<TriggerType>('ON_PLAY');
  const [costs, setCosts] = useState<EffectAction[]>([]);
  const [actions, setActions] = useState<EffectAction[]>([]);
  const [rawText, setRawText] = useState('');
  const [cardInput, setCardInput] = useState(cardName);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    const ability: CardAbility = {
      trigger,
      costs,
      actions,
      raw_text: rawText
    };

    const report: EffectReport = {
      correction: {
        cardName: cardInput,
        rawText,
        ability
      },
      note
    };
    onSubmit(report);
  };

  const addTopLevelAction = (list: EffectAction[], setList: React.Dispatch<React.SetStateAction<EffectAction[]>>) => {
    setList([...list, { type: 'OTHER', value: 0 }]);
  };

  return (
    <div style={styles.container}>
      <div style={styles.form}>
        <div style={{ padding: '10px 15px', background: '#2c3e50', borderBottom: '1px solid #7f8c8d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>🛠 Ability Builder</h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#bdc3c7', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={styles.scrollArea}>
          <div style={styles.section}>
            <div style={styles.row}>
              <span style={styles.label}>Card Name</span>
              <input value={cardInput} onChange={e => setCardInput(e.target.value)} style={{...styles.input, flex: 1}} />
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Raw Text</span>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)} style={{...styles.input, flex: 1, height:'40px'}} />
            </div>
          </div>

          <div style={styles.section}>
            <span style={{...styles.label, display:'block', marginBottom:'5px'}}>Trigger</span>
            <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} style={{...styles.input, width:'100%'}}>
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

          <div style={styles.section}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              <span style={{fontWeight:'bold'}}>Costs</span>
              <button onClick={() => addTopLevelAction(costs, setCosts)} style={styles.btn('#7f8c8d')}>+ Add Cost</button>
            </div>
            {costs.map((c, i) => (
              <ActionEditor 
                key={i} 
                action={c} 
                onChange={val => { const n = [...costs]; n[i] = val; setCosts(n); }}
                onDelete={() => setCosts(costs.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          <div style={styles.section}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              <span style={{fontWeight:'bold'}}>Actions</span>
              <button onClick={() => addTopLevelAction(actions, setActions)} style={styles.btn('#27ae60')}>+ Add Action</button>
            </div>
            {actions.map((a, i) => (
              <ActionEditor 
                key={i} 
                action={a} 
                onChange={val => { const n = [...actions]; n[i] = val; setActions(n); }}
                onDelete={() => setActions(actions.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
          
          <div style={styles.section}>
             <span style={styles.label}>Note</span>
             <textarea value={note} onChange={e => setNote(e.target.value)} style={{...styles.input, width:'100%', height:'50px'}} />
          </div>
        </div>

        <div style={{ padding: '15px', background: '#2c3e50', borderTop: '1px solid #7f8c8d', display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{...styles.btn('#95a5a6'), flex: 1, padding: '12px', fontSize:'16px'}}>Cancel</button>
          <button onClick={handleSubmit} style={{...styles.btn('#e67e22'), flex: 1, padding: '12px', fontSize:'16px'}}>Submit Report</button>
        </div>
      </div>
    </div>
  );
};
