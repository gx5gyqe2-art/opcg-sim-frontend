# リファクタリング詳細設計③: RealGame.tsx のフック分割と盤面レイアウト計算の共通化

- 対象: `src/screens/RealGame.tsx`（2,451行）、`src/ui/BoardSide.tsx`（317行）、
  `src/ui/SandboxBoardSide.tsx`（228行）
- 目的: 単一関数コンポーネントに凝集した通信・PIXI描画・入力・画面UIを分離し、
  盤面座標計算の二重実装を単一ソース化する。**見た目・操作・通信の挙動は一切変えない**。
- ステータス: 設計(実装は本書承認後に別PRで段階実施)
- 関連: バックエンド側の設計 `opcg-sim-backend/docs/refactoring_gamestate.md` / `refactoring_api_app.md`

---

## 0. 現状の責務インベントリ（行マップ・実測）

### RealGame.tsx（2,451行・実質1関数）

| 責務 | 現在地（行） | 規模 |
|---|---|---|
| モジュールレベル純関数（resolveCard / findCardContainer / cardGlobalPos / resolveUuidByName / drawBattleArrow / FXパレット / トースト定義） | L39–192 | ~150行 |
| state/ref 宣言（**useState 28 / useRef 26**） | L223–341 | ~120行 |
| イベントログ＋盤面フラッシュ＋トースト（addEventLog） | L344–389 | ~45行 |
| コイントス演出トリガー / デッキ一覧取得 | L402–431 | ~30行 |
| **オンライン**: WS 購読＋指数バックオフ再接続 | L436–481 | ~45行 |
| **オンライン**: 取りこぼし再同期ポーリング（3秒） | L488–501 | ~15行 |
| **CPU**: cpu/step ポーリング駆動（思考と演出の重ね合わせ） | L505–545 | ~40行 |
| アクション送信ハンドラ群（handleAction / handlePass / handleSelectionResolve / handleOptionSelect / handleDeclareCost / handleOptionalConfirm / handleMulligan / handleKeepHand / handleTurnEnd / sendRuleLobbyAction） | L548–667 | ~120行 |
| 選択モード派生値（boardUuids / isBoardSelectMode / donTargetUuids / donReturn系 / highlightUuids / min・maxSelect / decisionNote） | L672–765 | ~95行 |
| 盤面入力（onCardClick 140行 / onCardDragStart / 選択リセット effect） | L767–959 | ~190行 |
| **PIXI**: app 初期化＋リサイズ＋startGame 発火 | L961–1012 | ~50行 |
| **PIXI**: renderScene（全再構築＋reconcile＋移動グライド） | L1014–1155 | ~140行 |
| **PIXI**: ドラッグ&ドロップ実体（ゴースト/攻撃テザー/ドロップ判定、**単一 useEffect 323行**） | L1160–1484 | ~325行 |
| **PIXI**: 攻撃演出（チャージ→ストライク→着弾） / 攻撃矢印常時表示 / アニメ速度 / ターンバナー | L1486–1655 | ~170行 |
| ログ採取（handleCaptureLogs） | L1674–1699 | ~25行 |
| **return①**: オンラインロビー画面（WAITING） | L1702–1798 | ~95行 |
| **return②**: ソロ/CPU セットアップ画面 | L1800–1929 | ~130行 |
| **return③**: メイン盤面 JSX（モーダル/バナー/オーバーレイ 10種） | L1974–2451 | ~480行 |

`react-hooks/exhaustive-deps` の eslint-disable が **8箇所**（L480, 544, 952, 1011, 1154, 1483, 1590, 1627）。
「最新値は effect 本体で参照する」運用で依存配列を意図的に絞っており、静的検査が効かない。

### BoardSide.tsx vs SandboxBoardSide.tsx の重複（実測）

両者で**逐語重複**しているもの:
- `SMALL_SCALE = 0.7` / `getX`（左右反転） / `getAdjustedY`（行→Y座標） … BoardSide L42–55 ≒ Sandbox L19–33
- ステージ抽出（field からの分離）… BoardSide L75–84（normalizeCardType）/ Sandbox L81–93（生文字列比較。
  **現在は等価だが実装が2つ**あり、種別追加時に乖離する）
- 手札レイアウト（maxHandWidth=W*0.9 / stepX / startX の圧縮計算）… BoardSide L249–263 ≒ Sandbox L203–216
- 各ゾーンの配置（field=row1 / leader・stage・life・deck=row2 / trash・don系=row3 / hand=row4、
  X は coords.get*X）… 全ゾーンで同一

意図的に異なるもの（共通化しない）:
- BoardSide: reconcile 用 `BoardItem`（movable/virtual）記述子、ライフの縦スタック＋枚数バッジ、選択ハイライト
- Sandbox: 長押し検出（L44–79）、ライフ/デッキ=単一パイル、全カードがドラッグ対象（setupInteractive）

## 1. 設計原則

1. **挙動不変**: 座標・z順・イベント配線・通信タイミングを変えない。フロントには自動テストが
   無い（CI は tsc / eslint / vite build のみ）ため、(a) 純関数抽出には**vitest を導入して
   ユニットテストを付ける**、(b) React 分割は「コード移動＋明示引数化」に徹する、の二本立てで守る。
2. **stale closure 対策の形式化**: 現行の「依存を絞って最新値は本体で参照」は正しい意図だが、
   eslint-disable で表現されている。`useLatest`（値を ref に写す定型フック）を導入し、
   **依存配列は正確に・最新値参照は ref で**を規約化する。目標: exhaustive-deps の disable 8→0。
   ただし**発火条件（＝依存配列のキー集合）は現行と同一に保つ**（発火頻度が変わると
   WS 再接続・CPU 駆動・再描画の挙動が変わるため）。
3. **Context / 状態管理ライブラリは導入しない**: フックへの分割で십分。引数と戻り値を明示し、
   画面（RealGame）が編成役を担う現構造を維持する（過剰設計の回避）。
4. **PIXI リソースの生存期間規約**: appRef / effectsRef / reconcilerRef は「PIXI 基盤フック」が
   所有し、他フックは**引数で受け取る**（refオブジェクト自体は安定なので依存に入れない）。

## 2. Phase F-A: 盤面レイアウト計算の共通化（先行・低リスク）

### 2-1. 新モジュール `src/ui/boardLayout.ts`（純関数のみ・PIXI 非依存）

```ts
// サイド（自陣/相手）の座標変換。BoardSide L46–55 と Sandbox L24–33 の単一ソース化。
export const sideTransforms = (isOpponent: boolean, W: number, coords: LayoutCoords) => ({
  getX: (baseX: number) => (isOpponent ? W - baseX : baseX),
  getAdjustedY: (row: number) => {
    const offset = coords.getY(row);
    return isOpponent ? coords.midY - offset - coords.CH / 2 : offset + coords.CH / 2;
  },
});

// 手札の圧縮レイアウト。BoardSide L249–263 と Sandbox L203–216 の単一ソース化。
export const computeHandLayout = (
  count: number, W: number, coords: LayoutCoords,
): { startX: number; stepX: number } => { /* 現行計算を逐語移動 */ };

// field 配列からステージを抽出。normalizeCardType 基準に統一
// （Sandbox の生文字列比較は現在等価だが、この統一で実装を1つにする）。
export const extractStage = (p: PlayerState): { stageCard: BoardCard | null; fieldCards: BoardCard[] };

export const SMALL_SCALE = 0.7;

// ゾーンごとの配置定義（座標のみ。描画は各呼び出し側）。
export const zonePositions = (isOpponent: boolean, W: number, coords: LayoutCoords) => ({
  field: (i: number, n: number) => ({ x: ..., y: getAdjustedY(1) }),
  leader: { x: ..., y: r2Y }, stage: {...}, life: {...}, deck: {...},
  trash: {...}, donDeck: {...}, donActive: {...}, donRest: {...},
  hand: (i: number, n: number) => ({ x: ..., y: r4Y }),
});
```

- `BoardSide.buildBoardItems` と `SandboxBoardSide.createSandboxBoardSide` は上記を import して
  座標計算部分を置き換える（描画・対話配線はそれぞれの責務のまま残す）。
- **削減見込み**: 両ファイル合計 545行 → 約 420行＋boardLayout ~90行。行数より
  「盤面座標の変更が1ファイルで完結する」ことが主目的。

### 2-2. vitest の導入（最小構成）

- devDependencies: `vitest` のみ（jsdom 不要 — boardLayout は純関数）。
- `src/ui/boardLayout.test.ts`: 手札枚数 1/5/10/20 枚時の startX/stepX、相手側の getX 反転、
  row→Y の対称性、extractStage（英/日表記・stage プロパティ優先）をアサート。
  **先に現行 BoardSide の計算結果をテストに焼き付けてから**共通化する
  （characterization test = 挙動不変の証明）。
- CI（.github/workflows/ci.yml）へ `npx vitest run` ステップを追加。

## 3. Phase F-B: RealGame.tsx の分割

### 3-1. 新構成 `src/screens/realgame/`

```
src/screens/realgame/
├── RealGame.tsx           # 編成のみ: フック呼び出し＋3画面の分岐＋盤面 JSX（~350行）
├── gameStateQueries.ts    # resolveCard / resolveUuidByName / getPhysicalLocation（純関数・現 L74–125, 854–870）
├── boardFx.ts             # FXパレット / drawBattleArrow / drawAttackLine / findCardContainer / cardGlobalPos（PIXI 純関数・現 L88–192, 1228–1300）
├── toastConfig.ts         # TOAST_* / PENDING_ACTION_LABELS / effectToastText（現 L39–72, 127–128）
├── useLatest.ts           # 定型: 値→ref 写経フック（stale closure 対策の規約化）※共通 utils へ置いても良い
├── useOnlineRoom.ts       # WS購読＋再接続＋再同期ポーリング＋ロビー操作（現 L232–243, 436–501, 548–557）
├── useCpuDriver.ts        # cpu/step ポーリング＋cpuThinking＋アニメ速度連動（現 L237–239, 505–545, 1631–1634）
├── useSelectionModes.ts   # 選択モード派生値の一括導出（現 L672–765）
├── useGameHandlers.ts     # handle* 群（useGameAction をラップ。現 L559–667, 1666–1699）
├── usePixiBoard.ts        # PIXI app 生成/破棄＋renderScene＋グライド（現 L961–1155）→ BoardRuntime を返す
├── useBoardDrag.ts        # D&D 実体（ゴースト/攻撃テザー/ドロップ判定。現 L1160–1484）
├── useBattleFx.ts         # 攻撃演出＋攻撃矢印＋ターンバナー＋コイントス（現 L402–410, 1486–1655）
├── OnlineRoomSetup.tsx    # return①（現 L1702–1798）
├── SoloCpuSetup.tsx       # return②（現 L1800–1929）
└── DecisionOverlays.tsx   # return③内のモーダル/バナー群（マリガン/任意効果/コスト宣言/盤面選択/ドン返却/汎用バナー。現 L2101–2377）
```

既存 `src/screens/RealGame.tsx` は `export { RealGame } from './realgame/RealGame'` の
再エクスポートにして App.tsx の import を不変に保つ（最終PRで整理）。

### 3-2. 各フックの契約（シグネチャ設計）

**usePixiBoard** — PIXI 基盤の所有者。他フックへの共有物を1つの束で返す:

```ts
export interface BoardRuntime {
  appRef: RefObject<PIXI.Application | null>;
  effectsRef: RefObject<EffectsLayer | null>;
  reconcilerRef: RefObject<BoardReconciler | null>;
}
export const usePixiBoard = (args: {
  containerRef: RefObject<HTMLDivElement>;
  boardReady: boolean;
  gameState: GameState | null;
  viewerId: 'p1' | 'p2';
  activePlayerId?: 'p1' | 'p2';
  boardSelected: string[];
  highlightUuids: Set<string>;
  fixedViewer: boolean;
  onCardClick: (card: CardInstance, pos: XY) => void;
  onCardDragStart: (card: CardInstance, pos: XY) => void;
  onInit: () => void;          // 現行 L987–994 の startGame 発火（ソロ/CPU のみ）を外出し
  renderDeps: unknown[];       // renderScene の再実行キー（現行 L1155 の配列と同一に固定）
}): { runtime: BoardRuntime; layoutCoords: XY | null };
```

- renderScene の依存キー（`[gameState, activePlayerId, isAttackTargeting, attackingCardUuid,
  pendingRequest, boardSelected, isDonTargeting]`）は**現行の列挙をそのまま**引数で受ける。
  発火条件の同一性を PR レビューの必須確認項目にする。
- onCardClick / onCardDragStart は毎レンダー再生成されるが、renderScene は依存に取らず
  `useLatest` 経由で最新を参照（現行の「本体で最新参照」と同じ意味論を disable 無しで表現）。

**useOnlineRoom** — オンライン専用状態の完全な持ち主:

```ts
export const useOnlineRoom = (args: {
  isOnline: boolean; gameId?: string; isMyDecision: boolean;
  winner: string | null | undefined;
  onState: (gs: GameState, pending: PendingRequest | null, events?: ActionEvent[]) => void;
}): {
  roomStatus: 'WAITING' | 'PLAYING' | 'FINISHED';
  readyStates: { p1: boolean; p2: boolean };
  deckPreview: DeckPreviewMap;
  wsConnected: boolean;
  reconnectAttempt: number;
  sendLobbyAction: (a: LobbyAction) => Promise<void>;
};
```

- WS effect の依存は現行どおり `[isOnline, gameId]`。onState は useLatest で参照。
  再同期ポーリングの依存（roomStatus / isMyDecision / winner）も現行キーを維持。

**useCpuDriver** — CPU 駆動ループ:

```ts
export const useCpuDriver = (args: {
  vsCpu: boolean; gameState: GameState | null; pendingRequest: PendingRequest | null;
  onState: (...);  onError: (msg: string) => void;
}): { cpuThinking: boolean };
```

- 450ms/700ms の演出クッションと respPromise 並走（思考の裏隠し）は**逐語移動**。
  cpuBusyRef による多重起動ガードもフック内へ。

**useSelectionModes** — 派生値のみ（state を持たない）。入力
`(gameState, pendingRequest, viewerId, flags)` → 出力
`{ boardUuids, isBoardSelectMode, selectableUuids, donTargetUuids, isDonReturnMode,
donReturnCandidates, donReturnHighlight, highlightUuids, minSelect, maxSelect, decisionNote,
showSearchModal, modalCandidates, activeDonCount }`。
現在毎レンダー再計算しており、それを維持する（useMemo 化は挙動不変だが別PRの最適化とする）。

**useBoardDrag** — 323行 effect の移設。BoardRuntime と選択モードフラグを受け、
window listener の登録/解除を内包。依存キー（現 L1484 の列挙）を維持。

### 3-3. stale closure 対策の規約（useLatest）

```ts
export const useLatest = <T,>(value: T): RefObject<T> => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};
```

- 各フックで「発火キー＝依存配列（正確に列挙）」「参照値＝useLatest ref」と役割を分ける。
- これにより現行8箇所の `eslint-disable react-hooks/exhaustive-deps` を撤去する。
  **例外**: PIXI app 初期化（現 L1011、マウント1回の意図）は `boardReady` のみ依存が正しく、
  onInit コールバック化で disable 不要になる見込み。撤去できない箇所が残る場合は
  理由コメント付きで許容（目標 0、上限 2）。

### 3-4. JSX の分割

- **OnlineRoomSetup / SoloCpuSetup**: 現在の2つの早期 return を props 明示のコンポーネントへ。
  状態は親（RealGame）が持ち、コールバックで返す（deckOptions / p1DeckId / firstChoice 等）。
- **DecisionOverlays**: return③内の「pendingRequest の種類で出し分けるモーダル/バナー10種」
  （マリガン / CONFIRM_OPTIONAL / DECLARE_COST / 盤面選択バナー / ドン返却バナー / 汎用バナー /
  ターン終了ボタン / CardActionMenu / CardDetailSheet / CardSelectModal）を1コンポーネントに移設。
  useSelectionModes の出力と useGameHandlers のハンドラをそのまま props で渡す。
- RealGame.tsx 本体に残るのは: フック編成・viewerId 等のモード導出（現 L217–337）・
  3画面の分岐・盤面コンテナ div とステータスチップ類。**目標 ~350行**。

## 4. 移行手順（PR 分割）

| PR | 内容 | リスク | ゲート |
|---|---|---|---|
| F-1 | vitest 導入＋boardLayout.ts 新設（characterization test → BoardSide/SandboxBoardSide を置換） | 低 | tsc / eslint / build / vitest ＋ 手動スモーク（後述チェックリストの盤面表示系） |
| F-2 | 純関数の抽出（gameStateQueries / boardFx / toastConfig）＋ useLatest 追加。RealGame は import 置換のみ | 低 | tsc / eslint / build |
| F-3 | 画面分割（OnlineRoomSetup / SoloCpuSetup / DecisionOverlays） | 中 | 手動スモーク（3モードの画面遷移） |
| F-4 | 通信フック（useOnlineRoom / useCpuDriver）＋ useGameHandlers | 中 | 手動スモーク（オンライン2タブ・CPU 1局・再接続） |
| F-5 | PIXI フック（usePixiBoard / useBoardDrag / useBattleFx）＋ useSelectionModes | **高** | 手動スモーク全項目＋ eslint-disable 残数確認 |
| F-6 | 仕上げ: 旧 RealGame.tsx を再エクスポート化 → 実体移動、SPEC.md/screen-design.md 更新 | 低 | 全ゲート |

### 手動スモークのチェックリスト（各PRの説明に結果を記載）

1. **ソロ**: セットアップ→マリガン→ドン付与（タップ/ドラッグ両方）→登場→アタック→
   カウンター→ブロック→効果対象選択（盤面選択とモーダル選択の両方）→ターン終了→決着
2. **CPU**: コイントス表示→CPU 思考中表示→CPU の連続手番の演出→人間宛て選択要求（トリガー確認）
3. **オンライン**: 2タブでルーム作成→デッキ選択→開始→WS 切断/再接続（DevTools でオフライン化）→
   相手待ちポーリング復帰→決着
4. **フリーモード（Sandbox）**: F-1 の影響確認（盤面配置が不変・長押し詳細・ドラッグ移動）
5. **表示**: 攻撃テザー/攻撃矢印/移動グライド/効果トースト/ターンバナーが従来どおり出る

## 5. 非目標（別Issue/別設計）

- SandboxGame.tsx と RealGame の画面統合（M-1）。F-A で座標計算は共通化されるため、
  将来 SandboxGame を BoardSide 系へ寄せる際の土台にはなる。
- localLogic.ts のルール二重実装解消・shared_constants.json の同期自動化（洗い出し H-2/M-3）
- API 型のコード生成（M-2）。`as unknown as` の除去は型生成側で根治する
  （本リファクタでは移動先で touch する箇所のみ、挙動不変の範囲で型を正す）。
- インラインスタイルのトークン化/CSS 整理（M-4）
- useMemo による派生値のメモ化等のパフォーマンス最適化（挙動同一でも別PRで計測とセットで行う）

## 6. リスクと対策

| リスク | 対策 |
|---|---|
| 依存配列の変更による発火頻度の変化（WS 再接続・CPU 多重駆動・再描画ループ） | 各 effect の「発火キー集合」を現行と同一に保つことを設計に明記（§3-2）。PR レビューで移行前後の依存配列を対で確認 |
| PIXI リソースの破棄順序が変わりクラッシュ/リーク | usePixiBoard に生成と破棄を閉じ込め、破棄手順（detachTweenTicker→clearTweens→app.destroy）を現行順序のまま移動。他フックは ref 越しに参照のみ |
| ドラッグ effect（323行）の移設ミス | 逐語移動＋`git diff --color-moved` で移動検証。スモーク①でタップ/ドラッグ両導線を確認 |
| 自動テスト不在での回帰 | F-1 の characterization test（レイアウト）＋手動スモークチェックリストの固定化。テスト導入自体が本設計の成果物の一つ |
| 再エクスポートの循環/HMR 不調 | F-6 まで旧パスを残し、最後に一括で参照を張り替える |

## 7. 完了条件

- RealGame.tsx（編成部）が 400行以下・useState/useRef はモード導出と選択 UI 状態のみ。
- `react-hooks/exhaustive-deps` の disable が RealGame 系で 0（上限2・理由コメント必須）。
- 盤面座標計算の実装が boardLayout.ts の1箇所のみ（BoardSide/SandboxBoardSide から重複消滅）。
- vitest が CI に組み込まれ、boardLayout のテストが green。
- 手動スモーク全項目 pass（各PRに結果記載）。
- docs/SPEC.md・screen-design.md がモジュール構成を反映。
