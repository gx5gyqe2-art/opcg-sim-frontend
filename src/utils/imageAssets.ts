import { API_CONFIG } from '../api/api.config';
import { logger } from './logger';

// 画像キャッシュ版数（バックエンドの /api/assets/version 由来）。
// URL に ?v= として付与し、版数が変わったときだけブラウザ/SW キャッシュを無効化する。
// 起動直後の取得完了前は localStorage の前回値を使い、描画をブロックしない。
let imageVersion: string = (() => {
  try { return localStorage.getItem('opcg_img_v') || '0'; } catch { return '0'; }
})();

export const setImageVersion = (v: string): void => {
  if (!v || v === imageVersion) return;
  imageVersion = v;
  try { localStorage.setItem('opcg_img_v', v); } catch { /* ignore */ }
};

// カードIDから画像URLを取得する統一関数
export const getCardImageUrl = (cardId: string): string => {
  if (!cardId) return '';
  return `${API_CONFIG.IMAGE_BASE_URL}/${cardId}.png?v=${imageVersion}`;
};

// 特定のキー（Deck, Life, Don!! Deck）用の裏面画像URL
export const getBackImageUrl = (type: 'DON' | 'MAIN' = 'MAIN'): string => {
  if (type === 'DON') return `${API_CONFIG.IMAGE_BASE_URL}/DON_back.png`;
  return `${API_CONFIG.IMAGE_BASE_URL}/OPCG_back.png`;
};

// 全カードの画像をプリフェッチ（キャッシュ）する関数
// 【修正】強制的にネットワークから取得してキャッシュを上書きするように変更
export const prefetchAllCardImages = async (cards: { uuid: string; card_id?: string }[], onProgress?: (current: number, total: number) => void) => {
  logger.log({ level: 'info', action: 'assets.prefetch_start', msg: 'Starting image prefetch (Force Update)', payload: { count: cards.length } });
  
  const uniqueIds = Array.from(new Set(cards.map(c => {
    return c.card_id || c.uuid;
  }).filter(id => id)));

  let loaded = 0;
  const total = uniqueIds.length;
  const BATCH_SIZE = 5;
  
  // vite.config.ts で設定されているキャッシュ名と一致させる必要があります
  const CACHE_NAME = 'card-images-cache'; 
  
  try {
    // Cache Storage を直接開く
    const cache = await caches.open(CACHE_NAME);

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = uniqueIds.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (id) => {
        const url = getCardImageUrl(id);  // ?v=<版数> を含む
        try {
          // URL に版数(?v=)が入っているため、版数が変わったときだけ新規取得になる。
          // 同一版数では SW/HTTP キャッシュにヒットし、不要な再ダウンロードをしない。
          const response = await fetch(url, { mode: 'cors' });

          if (response.ok) {
            // 版数付き URL をキーにキャッシュへ保存（img src と同一キー）
            await cache.put(url, response);
          } else {
             console.warn(`Failed to fetch image for ${id}: ${response.status}`);
          }
        } catch (e) {
          console.warn(`Failed to fetch image for ${id}`, e);
        }
      }));
      
      loaded += batch.length;
      if (onProgress) onProgress(Math.min(loaded, total), total);
    }
  } catch (err) {
    // Cache APIが使えない環境などのフォールバック
    logger.log({ level: 'error', action: 'assets.prefetch_error', msg: 'Error accessing cache storage', payload: { error: err } });
    
    // フォールバック: 版数付き URL をそのまま取得（SW/HTTP キャッシュに委ねる）
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(id => fetch(getCardImageUrl(id), { mode: 'cors' })));
        loaded += batch.length;
        if (onProgress) onProgress(Math.min(loaded, total), total);
    }
  }

  logger.log({ level: 'info', action: 'assets.prefetch_complete', msg: 'Image prefetch completed' });
};