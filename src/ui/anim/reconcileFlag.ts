// 盤面のコンテナ差分再利用（Phase4 reconcile）の有効化フラグ。
// 既定 OFF（既知安定の全再構築）。`VITE_RECONCILE_BOARD=1` で ON。
// 検証後にデフォルト反転を検討する。
export const RECONCILE_BOARD: boolean = import.meta.env.VITE_RECONCILE_BOARD === '1';
