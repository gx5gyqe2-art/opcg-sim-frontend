// 盤面のコンテナ差分再利用（Phase4 reconcile）の有効化フラグ。
// 既定 ON。問題が出たら `VITE_RECONCILE_BOARD=0` のビルドで従来の全再構築に戻せる。
export const RECONCILE_BOARD: boolean = import.meta.env.VITE_RECONCILE_BOARD !== '0';
