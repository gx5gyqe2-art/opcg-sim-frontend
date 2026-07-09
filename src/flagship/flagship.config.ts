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

/** 大会種別の定義。表示（バッジ・短縮名）と発見（keyword）の単一の正本。 */
export interface KindDef {
  /** 正式な大会種別名。`event_series_title` の先頭・keyword 検索語・`SERIES.kind` と一致させる。 */
  kind: string;
  /** 一覧バッジ・KPI サブラベルの短縮表示。 */
  short: string;
  /** バッジのスタイル修飾（CSS クラス `fs-kind-<badge>`）。 */
  badge: string;
}

/**
 * 発見・表示対象の大会種別（この順で表示）。**種別を増やすときはここに1行足す**のが基本。
 *
 * 店舗予選（チャンピオンシップの店舗予選）は 10 月開催・9 月頃発表予定（現在 TCG+ に無し）。
 * 名称/形式が確定したら下のコメントを有効化する（§16.15）。**店舗予選はシーズン制で
 * 「<種別>（N月開催）」形式ではない**点に注意。有効化時に追加で必要な作業:
 *   1) ここに `{ kind:'<正式名>', short:'店舗予選', badge:'qual' }` を追加
 *   2) `seriesDiscovery.parseSeriesTitle` を店舗予選のタイトル形式へ対応（月は開催日から導出）
 *   3) `FlagshipEvents` の月スロットを 2→3 にし `qualSeries` を追加
 *   4) バッジ `.fs-kind-qual` は用意済み（CSS）
 */
export const KIND_DEFS: readonly KindDef[] = [
  { kind: 'フラッグシップバトル', short: 'フラッグシップ', badge: 'fs' },
  { kind: 'エクストラグランドバトル', short: 'エクストラ', badge: 'ex' },
  // { kind: 'チャンピオンシップ… 店舗予選', short: '店舗予選', badge: 'qual' },  // §16.15（9月に確定）
] as const;

/**
 * 自動取得の鮮度しきい値（ミリ秒）。最終取得からこの時間を超えていれば
 * 画面表示時に自動再取得する。TCG+ API への礼儀（日次1回程度）に合わせて 24 時間。
 * 「取得」ボタンによる手動取得はこのガードを無視する。
 */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** localStorage キーのバージョンプレフィックス。整形スキーマ変更時に上げる。 */
export const CACHE_KEY_PREFIX = 'opcg_flagship_v1';
