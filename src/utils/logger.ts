import CONST from '../../shared_constants.json';

// JSONからキー名の定義を取得
const K = CONST.LOG_CONFIG.KEYS;

// ログレベルとソースの型定義
type LogLevel = 'debug' | 'info' | 'error';
type PlayerType = 'p1' | 'p2' | 'system' | 'unknown' | string;

interface LogOptions {
  level: LogLevel;
  action: string;      // 短い動詞（例: card.tap, api.receive）
  msg: string;         // 簡単なメッセージ（例: "API response success"）
  sessionId: string;   // sid
  player?: PlayerType; // 任意（p1, p2, system...）
  payload?: any;       // 構造体（任意）
}

export const logger = {
  log: ({ level, action, msg, sessionId, player = "unknown", payload }: LogOptions) => {
    // ローカル時刻 (HH:mm:ss)
    const now = new Date().toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const source = "FE"; // フロントエンド固定
    
    // 1行目のヘッダー: [時刻][FE][level][sid=xxx][player]
    const header = `[${now}][${source}][${level}][${K.SESSION}=${sessionId}][${player}]`;
    const summary = `${action} >> ${msg}`;
    
    // コンソール用カラースタイル
    const styles = {
      debug: 'color: #7f8c8d; font-family: monospace;',
      info:  'color: #2ecc71; font-weight: bold; font-family: monospace;',
      error: 'color: #e74c3c; font-weight: bold; font-family: monospace;',
      summary: 'color: #ffffff; font-weight: bold;'
    };

    // グループ化出力
    console.groupCollapsed(`%c${header} %c${summary}`, styles[level], styles.summary);
    
    // バックエンドとキー名を統一したログオブジェクト
    const logObject = {
      [K.TIME]: now,
      [K.SOURCE]: source,
      [K.LEVEL]: level,
      [K.SESSION]: sessionId,
      [K.PLAYER]: player,
      [K.ACTION]: action,
      [K.MESSAGE]: msg,
      ...(payload && { [K.PAYLOAD]: payload })
    };

    console.log(logObject);
    console.groupEnd();
  }
};
