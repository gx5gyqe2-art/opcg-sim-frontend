import React from 'react';

interface DebugReporterProps {
  data: any; // 保存したいデータ（gameStateなど）
}

export const DebugReporter: React.FC<DebugReporterProps> = ({ data }) => {
  
  const handleReport = () => {
    // タイムスタンプ付与
    const reportData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...data
    };

    const jsonStr = JSON.stringify(reportData, null, 2);

    // 1. コンソールに出力（開発者用）
    console.group("🐞 BUG REPORT DATA");
    console.log(reportData);
    console.groupEnd();

    // 2. クリップボードにコピー
    navigator.clipboard.writeText(jsonStr)
      .then(() => {
        if (confirm("バグ報告用データをクリップボードにコピーしました。\n\nファイルとしてダウンロードもしますか？")) {
            downloadJson(jsonStr);
        }
      })
      .catch(err => {
        console.error("Copy failed", err);
        alert("コピーに失敗しました。コンソールを確認してください。");
      });
  };

  const downloadJson = (jsonStr: string) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug_report_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleReport}
      title="バグ報告用データを取得"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999, // 最前面
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: '#e74c3c',
        color: 'white',
        border: '3px solid white',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        fontSize: '24px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s',
      }}
      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
    >
      🐞
    </button>
  );
};
