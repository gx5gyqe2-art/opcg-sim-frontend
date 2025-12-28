import CONST from '../../shared_constants.json';
import { sessionManager } from './session';
import { API_CONFIG } from '../api/api.config';

const K = CONST.LOG_CONFIG.KEYS;
const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, "");

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type PlayerType = 'p1' | 'p2' | 'system' | 'unknown' | string;

interface LogOptions {
  level: LogLevel;
  action: string;
  msg: string;
  sessionId?: string;
  player?: PlayerType;
  payload?: any;
}

export const logger = {
  sendRemoteLog: (options: LogOptions) => {
    const LOG_URL = `${baseUrl}/api/log`;
    const sid = sessionManager.getSessionId();
    const now = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const source = "FE";

    const logObject = {
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

    fetch(LOG_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logObject)
    }).catch(() => {});
  },

  log: (options: LogOptions) => {
    const { level, action, msg, sessionId, player = "unknown" } = options;
    const sid = sessionId || sessionManager.getSessionId();
    const now = new Date().toLocaleTimeString('ja-JP', { hour12: false });
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

    if (level === 'error' || level === 'warn') {
      logger.sendRemoteLog(options);
    }
  },

  warn: (action: string, msg: string, payload?: any) => {
    logger.log({ level: 'warn', action, msg, payload });
  },

  error: (action: string, msg: string, payload?: any) => {
    logger.log({ level: 'error', action, msg, payload });
  }
};
