/**
 * 大会開催一覧（P1）の設定。
 *
 * 対象の開催期（シリーズ）ID と、開催マスター取得のキャッシュ方針をここで管理する。
 * 新しい開催期が始まったら SERIES 配列の先頭に追加する。ID は公式イベントページ
 * （onepiece-cardgame.com/events/flagship-battle-YYYYMM.html や
 * extra-grand-battle-YYYYMM.html）がリンクする BANDAI TCG+ のシリーズページ URL
 * 末尾から取得できる。フラッグシップ以外の大会（エクストラグランドバトル等）も
 * 同一 API・同一形式のため、ここに追加するだけで一覧・結果登録の対象になる。
 */

export interface FlagshipSeries {
  /** BANDAI TCG+ の event_series_id */
  id: number;
  /** 画面表示用のラベル（例: フラッグシップバトル(7月開催)） */
  label: string;
  /** 大会種別名（画面見出しに使う。例: フラッグシップバトル） */
  kind: string;
}

/** 対象の開催期。先頭が既定選択。 */
export const SERIES: readonly FlagshipSeries[] = [
  { id: 7664, label: 'フラッグシップバトル(8月開催)', kind: 'フラッグシップバトル' },
  { id: 7395, label: 'フラッグシップバトル(7月開催)', kind: 'フラッグシップバトル' },
  { id: 7665, label: 'エクストラグランドバトル(8月開催)', kind: 'エクストラグランドバトル' },
  { id: 7396, label: 'エクストラグランドバトル(7月開催)', kind: 'エクストラグランドバトル' },
] as const;

/** 既定で選択するシリーズ ID。 */
export const DEFAULT_SERIES_ID: number = SERIES[0].id;

/**
 * 自動取得の鮮度しきい値（ミリ秒）。最終取得からこの時間を超えていれば
 * 画面表示時に自動再取得する。TCG+ API への礼儀（日次1回程度）に合わせて 24 時間。
 * 「取得」ボタンによる手動取得はこのガードを無視する。
 */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** localStorage キーのバージョンプレフィックス。整形スキーマ変更時に上げる。 */
export const CACHE_KEY_PREFIX = 'opcg_flagship_v1';
