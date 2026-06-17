import CONST from '../../shared_constants.json';
import { sessionManager } from './session';

const K = CONST.LOG_CONFIG.KEYS;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type PlayerType = 'p1' | 'p2' | 'system' | 'unknown' | string;

interface LogOptions {
  level: LogLevel;
  action: string;
  msg: string;
  sessionId?: string;
  player?: PlayerType;
  payload?: unknown;
}

const logBuffer: unknown[] = [];

// ▼▼▼ 追加: ローカル時間をISO形式(YYYY-MM-DDTHH:mm:ss.SSS)にするヘルパー ▼▼▼
const getLocalISOString = () => {
  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');
  
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
};
// ▲▲▲ 追加ここまで ▲▲▲

const createLogPayload = (options: LogOptions) => {
  const sid = options.sessionId || sessionManager.getSessionId();
  // ▼▼▼ 修正: 独自のISO文字列生成を使用 ▼▼▼
  const now = getLocalISOString();
  // ▲▲▲ 修正ここまで ▲▲▲
  const source = "FE";

  return {
    [K.TIME]: now,
    [K.SOURCE]: source,
    [K.LEVEL]: options.level,
    [K.SESSION]: sid,
    [K.PLAYER]: options.player || "unknown",
    [K.ACTION]: options.action,
    [K.MESSAGE]: options.msg,
    [K.PAYLOAD]: options.payload,
    sessionId: sid
  };
};

export const logger = {
  // バックエンドの汎用ログ受け口（/api/log）は撤去済み。リモート送信は行わず、
  // コンソール出力のみに留める（無駄な 404 リクエストを出さない）。ログ採取は
  // 採取ボタン（クライアント履歴＋/replay のCPU思考トレース）に一本化した。
  sendRemoteLog: (_options: LogOptions) => { /* no-op: /api/log は廃止 */ },

  flushLogs: () => { logBuffer.length = 0; },

  log: (options: LogOptions) => {
    const { level, action, msg, sessionId, player = "unknown" } = options;
    const sid = sessionId || sessionManager.getSessionId();
    // ▼▼▼ 修正: 表示用も合わせる（必須ではないが見やすさのため） ▼▼▼
    const now = getLocalISOString();
    // ▲▲▲ 修正ここまで ▲▲▲
    const source = "FE";

    const header = `[${now}][${source}][${level}][${K.SESSION}=${sid}][${player}]`;
    const summary = `${action} >> ${msg}`;
    
    const styles = {
      debug: 'color: #7f8c8d; font-family: monospace;',
      info:  'color: #2ecc71; font-weight: bold; font-family: monospace;',
      warn:  'color: #f1c40f; font-weight: bold; font-family: monospace;',
      error: 'color: #e74c3c; font-weight: bold; font-family: monospace;',
      summary: 'color: #ffffff; font-weight: bold;'
    };

    console.groupCollapsed(`%c${header} %c${summary}`, styles[level], styles.summary);
    console.log("Details:", { ...options, sessionId: sid, time: now, source });
    console.groupEnd();

    logBuffer.push(createLogPayload(options));

    if (level === 'error' || level === 'warn') {
      logger.sendRemoteLog(options);
    }
  },

  warn: (action: string, msg: string, payload?: unknown) => {
    logger.log({ level: 'warn', action, msg, payload });
  },

  error: (action: string, msg: string, payload?: unknown) => {
    logger.log({ level: 'error', action, msg, payload });
  }
};
