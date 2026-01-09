import React, { useState } from 'react';
import { logger } from '../utils/logger';
import { EffectReportForm } from './EffectReportForm';
import { EffectReport } from '../game/effectReporting';

interface DebugReporterProps {
  data: any; // 保存したいデータ（gameStateなど）
}

export const DebugReporter: React.FC<DebugReporterProps> = ({ data }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEffectForm, setShowEffectForm] = useState(false);

  // 既存機能: JSONダンプとクリップボードコピー
  const handleDumpState = () => {
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
        if (confirm("現在のゲーム状態をクリップボードにコピーしました。\n\nファイルとしてダウンロードもしますか？")) {
            downloadJson(jsonStr);
        }
      })
      .catch(err => {
        console.error("Copy failed", err);
        alert("コピーに失敗しました。コンソールを確認してください。");
      });
    
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

  // 新機能: 効果定義レポート送信
  const handleEffectReport = (report: EffectReport) => {
    report.timestamp = new Date().toISOString();
    
    // 既存のロガーを利用してバックエンドにエラーとして送信（action名で区別）
    logger.error('EFFECT_DEF_REPORT', `効果定義報告: ${report.cardName}`, {
        report: report,
        gameStateSummary: {
            turn: data?.turn_info?.turn_count,
            phase: data?.turn_info?.current_phase,
            activePlayer: data?.turn_info?.active_player_id
        }
    });

    alert('効果定義を報告しました。開発チームに送信されます。');
    setShowEffectForm(false);
    setShowMenu(false);
  };

  return (
    <>
      {/* メインのフローティングボタン */}
      <div 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '10px'
        }}
      >
        {/* メニュー展開時 */}
        {showMenu && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
            <button
              onClick={() => setShowEffectForm(true)}
              style={{
                padding: '10px 15px',
                background: '#8e44ad',
                color: 'white',
                border: '2px solid white',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                fontWeight: 'bold'
              }}
            >
              🎴 効果の不足・誤りを報告
            </button>
            <button
              onClick={handleDumpState}
              style={{
                padding: '10px 15px',
                background: '#e67e22',
                color: 'white',
                border: '2px solid white',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                fontWeight: 'bold'
              }}
            >
              💾 状態をコピー/保存
            </button>
          </div>
        )}

        {/* トグルボタン */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          title="デバッグメニュー"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: showMenu ? '#7f8c8d' : '#e74c3c',
            color: 'white',
            border: '3px solid white',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            fontSize: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            transform: showMenu ? 'rotate(45deg)' : 'rotate(0deg)'
          }}
        >
          {showMenu ? '＋' : '🐞'}
        </button>
      </div>

      {/* 効果報告フォームモーダル */}
      {showEffectForm && (
        <EffectReportForm
          // 可能であればデータからカード名などを推測して渡すことも可能だが、
          // 現状は未入力で開始する
          cardName=""
          onSubmit={handleEffectReport}
          onCancel={() => setShowEffectForm(false)}
        />
      )}
    </>
  );
};
