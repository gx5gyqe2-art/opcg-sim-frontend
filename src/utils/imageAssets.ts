import { API_CONFIG } from '../api/api.config';
import { logger } from './logger';

// カードIDから画像URLを取得する統一関数
export const getCardImageUrl = (cardId: string): string => {
  if (!cardId) return '';
  return `${API_CONFIG.IMAGE_BASE_URL}/${cardId}.png`;
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
        const url = getCardImageUrl(id);
        try {
          // 1. キャッシュバスター(?update=...)をつけて強制的にネットワークから取得
          // これによりService Workerの古いキャッシュを回避し、必ず最新のバケットの画像を取りに行きます
          const response = await fetch(`${url}?update=${Date.now()}`, { mode: 'cors' });
          
          if (response.ok) {
            // 2. 取得したレスポンスを、元のURL（クエリなし）としてキャッシュに上書き保存
            // これで次回以降、アプリ内ではこの新しい画像が使われます
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
    
    // 従来の方法（ただしSWがいると効果が薄い場合があります）
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(id => fetch(getCardImageUrl(id), { cache: 'reload', mode: 'cors' })));
        loaded += batch.length;
        if (onProgress) onProgress(Math.min(loaded, total), total);
    }
  }

  logger.log({ level: 'info', action: 'assets.prefetch_complete', msg: 'Image prefetch completed' });
};