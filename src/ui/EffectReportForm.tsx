import React, { useState, useMemo, useRef } from 'react';
import type { 
  EffectReport, TriggerType, ActionType,
  EffectAction, TargetQuery,
  Zone, PlayerType
} from '../game/effectReporting';

// ... (Props, SimpleCard 定義は同じ)

export const EffectReportForm: React.FC<Props> = ({ cardName = '', gameState, activePlayerId, onSubmit, onCancel }) => {
  // ... (State定義は同じ)
  const [trigger, setTrigger] = useState<TriggerType>('ON_PLAY');
  
  // リストは EffectAction 型の配列になります
  const [costs, setCosts] = useState<EffectAction[]>([]);
  const [effects, setEffects] = useState<EffectAction[]>([]);
  // ...

  // --- 解析ロジック (バックエンド型へ変換) ---
  
  const guessCost = (text: string): EffectAction => {
    // デフォルト: その他コスト
    let action: EffectAction = {
      type: 'OTHER',
      value: 1,
      raw_text: text
    };

    if (text.match(/ドン!!\s*[-−]\s*(\d+)/)) {
      // ドン!!-X は RETURN_DON (resolver.py参照)
      action.type = 'RETURN_DON';
      action.value = parseInt(RegExp.$1);
    } else if (text.match(/ドン!!\s*(\d+)\s*枚をレスト/)) {
      // ドン!!レスト は REST_DON
      action.type = 'REST_DON';
      action.value = parseInt(RegExp.$1);
    } else if (text.match(/手札(\d+)枚を捨てる/)) {
      // 手札捨て は TRASH
      action.type = 'TRASH';
      action.source_zone = 'HAND';
      action.subject = 'SELF';
      action.value = parseInt(RegExp.$1);
      // 対象: 自分の手札
      action.target = {
        zone: 'HAND',
        player: 'SELF',
        count: parseInt(RegExp.$1),
        is_up_to: false
      };
    }
    return action;
  };

  const guessEffect = (text: string): EffectAction => {
    let type: ActionType = 'OTHER';
    let value = 0;
    
    // アクションタイプ推定
    if (text.includes('KO')) type = 'KO';
    else if (text.includes('手札に戻す')) type = 'MOVE_TO_HAND'; // resolverでは MOVE_TO_HAND
    else if (text.includes('レスト')) type = 'REST';
    else if (text.includes('アクティブ')) type = 'ACTIVE';
    else if (text.includes('引く')) type = 'DRAW';
    else if (text.includes('パワー')) type = 'BUFF'; // resolverでは BUFF
    else if (text.includes('登場')) type = 'PLAY_CARD';
    else if (text.includes('加える')) type = 'LIFE_MANIPULATE'; // ライフ等の場合

    const action: EffectAction = {
      type,
      value: 0,
      raw_text: text
    };

    // ターゲット推定 (Matcher用クエリ構築)
    if (['KO', 'MOVE_TO_HAND', 'REST', 'ACTIVE', 'BUFF'].includes(type)) {
      const countMatch = text.match(/(\d+)枚/);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      
      const isOpponent = !text.includes('自分'); // デフォルト相手
      
      action.target = {
        player: isOpponent ? 'OPPONENT' : 'SELF',
        zone: 'FIELD',
        card_type: ['CHARACTER'], // デフォルト
        count: count,
        is_up_to: text.includes('まで'), // "〜枚まで"
      };
    }

    // 値推定
    if (type === 'BUFF') {
      const buffMatch = text.match(/([+＋\-−]\d+)/);
      if (buffMatch) {
        action.value = parseInt(buffMatch[1].replace('＋', '+').replace('−', '-'));
      }
    } else if (type === 'DRAW') {
      const drawMatch = text.match(/(\d+)枚/);
      if (drawMatch) action.value = parseInt(drawMatch[1]);
    }

    return action;
  };

  const guessTrigger = (text: string): TriggerType | null => {
    if (text.includes('登場時')) return 'ON_PLAY';
    if (text.includes('アタック時')) return 'ON_ATTACK'; // WHEN_ATTACKING -> ON_ATTACK (Enum参照)
    if (text.includes('起動メイン')) return 'ACTIVATE_MAIN';
    if (text.includes('ブロック時')) return 'ON_BLOCK';
    if (text.includes('KO時')) return 'ON_KO';
    if (text.includes('トリガー')) return 'TRIGGER';
    if (text.includes('ターン終了時')) return 'TURN_END';
    return null;
  };

  // ... (applySelection や handleSelectCard は変更なし、型の整合性だけ注意) ...

  const handleSubmit = () => {
    const report: EffectReport = {
      correction: {
        cardName: inputCardName,
        rawText: rawText,
        ability: {
          trigger: trigger,
          costs: costs,
          actions: effects,
          raw_text: rawText
        }
      },
      verification: { expectedStateChanges: verifications },
      note: note
    };
    onSubmit(report);
  };

  // ... (JSX部分: updateCost, updateEffect などのヘルパー関数内のフィールド名を新しい型に合わせる)
  // 例: updateEffect(idx, 'type', val) -> updateEffect(idx, 'type', val as ActionType)
  // 例: updateEffectTarget などを TargetQuery のプロパティに合わせて修正が必要
  
  // UI部分は省略しますが、上記の `guessCost` 等のロジックを組み込むことで、
  // バックエンドがそのまま処理できる形式のデータを作成できます。
  
  return (
    // ... (前回と同じUI構造)
    <div></div>
  );
};
