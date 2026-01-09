import React, { useState } from 'react';
import { logger } from '../utils/logger';
import { EffectReportForm } from './EffectReportForm';
import type { EffectReport } from '../game/effectReporting';

interface DebugReporterProps {
  data: any;
}

export const DebugReporter: React.FC<DebugReporterProps> = ({ data }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEffectForm, setShowEffectForm] = useState(false);

  const handleDumpState = () => {
    // ... (既存の処理そのまま)
    const reportData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...data
    };
    const jsonStr = JSON.stringify(reportData, null, 2);
    console.group("🐞 BUG REPORT DATA");
    console.log(reportData);
    console.groupEnd();

    navigator.clipboard.writeText(jsonStr)
      .then(() => {
        if (confirm("現在のゲーム状態をクリップボードにコピーしました。\nファイルとしてダウンロードもしますか？")) {
            downloadJson(jsonStr);
        }
      })
      .catch(() => alert("コピーに失敗しました。"));
    setShowMenu(false);
  };

  const downloadJson = (jsonStr: string) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_state_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEffectReport = (report: EffectReport) => {
    const structuredPayload = {
      meta: {
        version: "2.0",
        timestamp: new Date().toISOString(),
        reporter: "User"
      },
      
      context: {
        ...data
      },

      correction: report.correction,
      verification: report.verification,
      
      note: report.note
    };
    
    logger.error('EFFECT_DEF_REPORT', `効果定義報告: ${report.correction.cardName}`, {
        payload: structuredPayload
    });

    alert('効果定義を報告しました。開発チームに送信されます。');
    setShowEffectForm(false);
    setShowMenu(false);
  };

  return (
    <>
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
        {showMenu && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
            <button onClick={() => setShowEffectForm(true)} style={{ padding: '10px 15px', background: '#8e44ad', color: 'white', border: '2px solid white', borderRadius: '20px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', fontWeight: 'bold' }}>
              🎴 効果の不足・誤りを報告
            </button>
            <button onClick={handleDumpState} style={{ padding: '10px 15px', background: '#e67e22', color: 'white', border: '2px solid white', borderRadius: '20px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', fontWeight: 'bold' }}>
              💾 状態をコピー/保存
            </button>
          </div>
        )}
        <button onClick={() => setShowMenu(!showMenu)} title="デバッグメニュー" style={{ width: '60px', height: '60px', borderRadius: '50%', background: showMenu ? '#7f8c8d' : '#e74c3c', color: 'white', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', transform: showMenu ? 'rotate(45deg)' : 'rotate(0deg)' }}>
          {showMenu ? '＋' : '🐞'}
        </button>
      </div>

      {showEffectForm && (
        <EffectReportForm
          cardName=""
          // ▼▼▼ 追加: Stateを渡す ▼▼▼
          gameState={data?.gameState || data} // データ構造に合わせて柔軟に
          activePlayerId={data?.activePlayerId || 'p1'}
          // ▲▲▲ 追加ここまで ▲▲▲
          onSubmit={handleEffectReport}
          onCancel={() => setShowEffectForm(false)}
        />
      )}
    </>
  );
};
