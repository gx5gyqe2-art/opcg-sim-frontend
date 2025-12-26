import CONST from '../../shared_constants.json';
import { sessionManager } from './session';
import { API_CONFIG } from '../api/api.config';

const K = CONST.LOG_CONFIG.KEYS;
const LOG_URL = `${API_CONFIG.BASE_URL}/api/log`;

type LogLevel = 'debug' | 'info' | 'error';
type PlayerType = 'p1' | 'p2' | 'system' | 'unknown' | string;

interface LogOptions {
  level: LogLevel;
  action: string;
  msg: string;
  sessionId?: string; // 任意に変更（managerから自動取得するため）
  player?: PlayerType;
  payload?: any;
}

export const logger = {
  log: ({ level, action, msg, sessionId, player = "unknown", payload }: LogOptions) => {
    // sessionIdが指定されていなければマネージャーから取得
    const sid = sessionId || sessionManager.getSessionId();
    const now = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const source = "FE";

    // 1. ローカルコンソール出力 (既存のロジック)
    const header = `[${now}][${source}][${level}][${K.SESSION}=${sid}][${player}]`;
    const summary = `${action} >> ${msg}`;
    
    const styles = {
      debug: 'color: #7f8c8d; font-family: monospace;',
      info:  'color: #2ecc71; font-weight: bold; font-family: monospace;',
      error: 'color: #e74c3c; font-weight: bold; font-family: monospace;',
      summary: 'color: #ffffff; font-weight: bold;'
    };

    console.groupCollapsed(`%c${header} %c${summary}`, styles[level], styles.summary);
    
    const logObject = {
      [K.TIME]: now,
      [K.SOURCE]: source,
      [K.LEVEL]: level,
      [K.SESSION]: sid,
      [K.PLAYER]: player,
      [K.ACTION]: action,
      [K.MESSAGE]: msg,
      ...(payload && { [K.PAYLOAD]: payload })
    };

    console.log(logObject);
    console.groupEnd();

    // 2. バックエンドへの転送 (新規追加)
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logObject),
    }).catch(() => {
      // 転送失敗自体のログでループしないよう無視
    });
  }
};
