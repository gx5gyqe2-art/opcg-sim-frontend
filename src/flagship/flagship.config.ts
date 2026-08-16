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
  /**
   * 開催月（1-12）。タイトルに月表記が無い種別（店舗予選＝シーズン制）は開催イベントの
   * 日付から導出するため、ラベル解析に頼らずここに持つ（§16.17）。
   * 未設定の古いキャッシュ・静的設定はラベルから読む（`seriesDiscovery.monthOf`）。
   */
  month?: number;
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
  /** 大会種別名。keyword 検索語・`SERIES.kind`・一覧の種別セレクタの値になる。 */
  kind: string;
  /** 一覧バッジ・KPI サブラベルの短縮表示。 */
  short: string;
  /** バッジのスタイル修飾（CSS クラス `fs-kind-<badge>`）。 */
  badge: string;
  /**
   * `event_series_title` の形式＝シリーズの判定方法と月の取り方（§16.17）。
   *
   * - `monthly`  … `<kind>（N月開催）` に完全一致。月はタイトルから取る
   *                （フラッグシップバトル／エクストラグランドバトル）
   * - `seasonal` … タイトルが `<kind>` を含む。シーズン制で月表記が無いため
   *                **月は開催イベントの日付から導出**し、ラベルはタイトルをそのまま使う
   *                （例: `チャンピオンシップ26-27 Season 2 店舗予選`）
   */
  titleForm: 'monthly' | 'seasonal';
}

/**
 * 発見・表示対象の大会種別（この順で表示）。**種別を増やすときはここに1行足す**のが基本。
 *
 * 種別を増やしたら `FlagshipEvents` の**開催期スロットも1つ増やす**こと（React のフックは
 * 数を固定する必要があるため、種別ごとに `useFlagshipEvents` を静的に並べている）。
 *
 * 店舗予選は `チャンピオンシップ26-27 Season 2 店舗予選`（series 7757・2026-09、実測 2026-08-16）。
 * シーズン制で「（N月開催）」表記が無いため `titleForm: 'seasonal'`（月は開催日から導出）。
 */
export const KIND_DEFS: readonly KindDef[] = [
  { kind: 'フラッグシップバトル', short: 'フラッグシップ', badge: 'fs', titleForm: 'monthly' },
  { kind: 'エクストラグランドバトル', short: 'エクストラ', badge: 'ex', titleForm: 'monthly' },
  { kind: '店舗予選', short: '店舗予選', badge: 'qual', titleForm: 'seasonal' },
] as const;

/**
 * 自動取得の鮮度しきい値（ミリ秒）。最終取得からこの時間を超えていれば
 * 画面表示時に自動再取得する。TCG+ API への礼儀（日次1回程度）に合わせて 24 時間。
 * 「取得」ボタンによる手動取得はこのガードを無視する。
 */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** localStorage キーのバージョンプレフィックス。整形スキーマ変更時に上げる。 */
export const CACHE_KEY_PREFIX = 'opcg_flagship_v1';
