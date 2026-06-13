# 計画書 — ルールモード CPU 対戦（フロントエンド）

本書は、ルールモードに CPU（AI）対戦を追加するための **フロントエンド側** 計画書である。
AI 本体・効果検証ハーネスを含む全体計画（正本）は
`opcg-sim-backend/docs/CPU_BATTLE_PLAN.md` を参照。フロント仕様の正本は [`docs/SPEC.md`](SPEC.md)。

- 開発ブランチ: `claude/rule-mode-cpu-battle-g2z8vi`。

---

## 0. 方針

AI はバックエンドに置く。フロントは **人間=p1** を操作し、CPU(p2) の手は
`/api/game/cpu/step` を **ポーリング** して 1 手ずつ受け取り、ステップ逐次でアニメ表示する
（WS は使わず REST のみ）。対局形態のマトリクスに 3 つ目を追加する。

```
              ソロ                       オンライン対戦                 CPU対戦 (新規)
ルール    RealGame('both')            RuleLobby → RealGame(p1/p2)+ws  RealGame('p1', vsCpu)+/api/game/cpu/*
```

---

## 1. メニュー導線（`src/ui/GameStart.tsx`）

PLAY 階層ナビ `root → mode(フリー/ルール) → match` のルールモード `match` を、現状の
ソロ / オンライン対戦の 2 択から **3 択（＋ CPU 対戦）** にする。CPU 対戦選択後:

- 難易度セレクト（かんたん `easy` / ふつう `normal` / つよい `hard`）。
- 自分のデッキと CPU のデッキ選択。

`onStart` に CPU 対戦と難易度を伝える経路を追加する。

---

## 2. RealGame 新モード `vsCpu`（`src/screens/RealGame.tsx`）

- 人間=`p1` 固定。`isOnline`（`myPlayerId==='p1'|'p2'`）とは別に **`vsCpu` フラグ** を導入する。
- **表示はオンラインと同等のものを再利用**:
  - 自陣（`viewerId='p1'`）を常に下側に描画。
  - 相手（上側）の手札は裏向き（`createBoardSide` の `hideHand`）。
  - 手番ゲート `isMyTurn` / `isMyDecision`（CPU の手番・CPU 宛の選択中は人間操作をロック）。
- **通信は REST `/api/game/*` ＋ポーリング**（`/ws/game` は使わない。単一クライアント）。
- 対局生成は `createGame` に CPU フラグ・難易度・CPU デッキを付けて呼ぶ。

---

## 3. CPU ポーリング駆動（`src/game/actions.ts`）

`useGameAction` に CPU ステップ駆動を追加する。

- **発火タイミング**: 人間がターンエンドした後 ／ 人間がアタック宣言した後（CPU 防御）／
  CPU 宛 `pending_request` が出現した時。
- **ループ**: `/api/game/cpu/step` を一定間隔（例 700ms）で呼び、レスポンスの `waiting_for` が
  `'cpu'` でなくなる（= `'human'` / `'human_decision'` / `'game_over'`）まで継続。
- **演出**: 各ステップのレスポンスで盤面を更新し、`action_events` を `EffectToast` /
  `ActionLog` に反映して 1 手ずつ見せる。CPU 思考中は「CPU 思考中…」バナーを表示し人間操作をロック。
- desync 防止: サーバはステートレスに「次の 1 手」を返すため、フロントは常に最新 `game_state` を
  正として描画するだけでよい。

---

## 4. API クライアント / 型 / 配線

| 対象 | 変更 |
|---|---|
| `src/api/client.ts` | `createGame` に CPU オプション（`vs_cpu` / `cpu_difficulty` / `cpu_deck`）、`cpuStep(gameId)` を追加 |
| `src/api/types.ts` | `waiting_for`（`'human' \| 'cpu' \| 'human_decision' \| 'game_over'`）、`cpu_acted` 等を追加 |
| `src/App.tsx` | `onStart` 経由で `ruleCpu`（vsCpu / 難易度 / デッキ）オプションを RealGame へ渡す経路を追加（`ruleOnline` と並列） |
| `shared_constants.json` | 難易度 enum・`waiting_for` 値・必要なら CPU 関連アクション型を追加（バックエンドと同期） |

---

## 5. 検証

- `npm ci` → `npx tsc -b`（型）→ `npx eslint .`（lint）→ `npx vite build`（ビルド）。
- 手動確認: ルールモード → CPU 対戦 → 難易度・デッキ選択 → 対局開始。
  人間ターンの操作、ターンエンド後に CPU が 1 手ずつ動くこと、人間のアタックに対する CPU の
  ブロック / カウンター、CPU 思考中の操作ロック、勝敗表示。

---

## 6. PR 分割上の位置づけ

全体計画（`opcg-sim-backend/docs/CPU_BATTLE_PLAN.md` §7）の **PR3** が本書の範囲。
バックエンドの `/api/game/cpu/step` と create フラグ（PR2）が前提。

---

## 7. 実装メモ（PR3 完了）

| 成果物 | パス |
|---|---|
| メニューに「CPU対戦」＋難易度（かんたん/ふつう/つよい） | `src/ui/GameStart.tsx`（`onStartCpu`、難易度選択パネル） |
| CPU 対戦モードの配線（`ruleCpu` 状態・`startRuleCpu`） | `src/App.tsx`（`RealGame` に `vsCpu`/`cpuDifficulty` を渡す） |
| RealGame の vsCpu 対応（自陣固定/相手手札裏向き/手番ゲート） | `src/screens/RealGame.tsx`（`fixedViewer`/`selfId`、CPU ポーリング useEffect、CPU 思考中バナー） |
| createGame の CPU オプション＋`cpuStep` | `src/api/client.ts`、`startGame` 拡張: `src/game/actions.ts` |
| 型 | `src/api/types.ts`（`CpuWaitingFor`/`CpuStepResult`） |

実装方針:
- 人間=p1 固定。`fixedViewer = isOnline || vsCpu` で自陣を下側固定・相手(CPU)手札を裏向き・
  手番ゲート（`isMyTurn`/`isMyDecision`）をオンラインと共通化。通信は REST のみ（WS 不使用）。
- CPU 駆動: `gameState`/`pendingRequest` の変化を監視し、CPU(p2) が行動すべき状況
  （p2 宛の選択要求、または p2 手番）で `/api/game/cpu/step` を 700ms 間隔でポーリング。
  `waiting_for !== 'cpu'` になるまで 1 手ずつ盤面・トースト・ログへ反映。`cpuBusyRef` で多重起動防止。
- デッキ選択は既存のソロ用「VS CPU SETUP」画面を再利用（人間=p1、CPU=p2）。
- 検証: `tsc -b` / `eslint .` / `vite build` すべて成功。バックエンド結合は
  `opcg-sim-backend/tests/test_cpu_ai.py`（create→人間 keep→cpu/step ポーリング進行）で確認済み。
