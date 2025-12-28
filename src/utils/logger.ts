import CONST from '../../shared_constants.json';
import { sessionManager } from './session';
import { API_CONFIG } from '../api/api.config';

const K = CONST.LOG_CONFIG.KEYS;
const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, "");
const LOG_URL = `${baseUrl}/api/log`;

type LogLevel = 'debug' | 'info' | 'error';
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
  log: ({ level, action, msg, sessionId, player = "unknown", payload }: LogOptions) => {
    const sid = sessionId || sessionManager.getSessionId();
    const now = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const source = "FE";

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
      [K.PAYLOAD]: payload,
      sessionId: sid
    };

    console.log("Details:", logObject);
    console.groupEnd();

    fetch(LOG_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logObject)
    }).catch(() => {});
  }
};
