# システム仕様書 — opcg-sim-frontend

本書は `opcg-sim-frontend`（React + Vite + Pixi.js のクライアント）の**システム仕様書**である。
バックエンド仕様は `opcg-sim-backend/docs/SPEC.md`、ユーザ目線の機能分類は
[`docs/user-feature-classification.md`](user-feature-classification.md)。

---

## 0. 全体構成

`src/App.tsx` が画面モード（`AppMode`）を切り替えるルートコンポーネント。状態は `sessionStorage`
で復元する（リロード/クラッシュ耐性）。

| AppMode | 画面 | 用途 |
|---|---|---|
| `start` | `ui/GameStart.tsx` | メインメニュー（PLAY 階層ナビ／Deck & Cards） |
| `game` | `screens/RealGame.tsx` | **ルールモード**（ソロ＝ホットシート／オンライン対戦） |
| `sandbox` | `screens/SandboxGame.tsx` | **フリーモード**（ソロ／オンライン対戦） |
| `lobby` | `screens/RoomLobby.tsx` | フリーモードのオンライン ルームロビー |
| `ruleLobby` | `screens/RuleLobby.tsx` | **ルールモードのオンライン ルームロビー** |
| `deck` / `cardList` | `screens/DeckBuilder.tsx` | デッキ作成・一覧／カード閲覧 |

### モード × 対戦形態のマトリクス
```
              ソロ                         オンライン対戦                         CPU対戦
フリー    SandboxGame(role='both')   RoomLobby → SandboxGame(role=p1/p2)+/ws/sandbox   —
ルール    RealGame(myPlayerId='both')  RuleLobby → RealGame(myPlayerId=p1/p2)+/ws/game   RealGame(vsCpu)+/api/game/cpu/step
```
メニュー導線（`GameStart`）: `PLAY → モード(フリー/ルール) → プレイ(ソロ/オンライン対戦/CPU対戦)`。
CPU 対戦はルールモードのみ。選択後に難易度（かんたん/ふつう/つよい）を選ぶ。詳細は §1.1.5。

---

## 1. ルールモード（RealGame）

`screens/RealGame.tsx`。Pixi で盤面を描画し、バックエンドの公式ルールエンジン（`/api/game/*`）と
通信する。`myPlayerId` プロップで挙動が分岐する。

- `myPlayerId='both'`（ソロ／ホットシート）: 従来挙動。現在の手番プレイヤーを下側に描画し、両者を1端末で操作。`apiClient.createGame` で対局生成。
- `myPlayerId='p1'|'p2'`（オンライン対戦）: 後述のオンライン挙動。
- `vsCpu`（CPU 対戦）: 人間=p1 固定。後述 §1.1.5。

### 1.1 オンライン対戦
- **接続**: `/ws/game/{gameId}` を購読（指数バックオフ再接続）。`STATE_UPDATE` で `roomStatus`／`ready_states`／`deck_preview`／`game_state`／`pending_request` を反映。
- **ルームセットアップ**（`roomStatus==='WAITING'`）: 自分のデッキ選択（`/api/rule/action` `SET_DECK`）、準備状況表示、ホスト(p1)の `START`。
- **視点固定**: 自陣（`viewerId=myPlayerId`）を常に下側に描画。相手（上側）の手札は**裏向き表示**（`createBoardSide` の `hideHand`、フロント側での情報秘匿）。
- **手番ゲート**: `isMyTurn`（自分の手番のときのみメイン操作可）／`isMyDecision`（選択要求 `pending_request.player_id===myPlayerId` のときのみ各種オーバーレイ/モーダルを表示・操作可）。攻撃時は防御側だけがブロッカー/カウンターを選べる。
- **状態同期**: 自分のアクションは `/api/game/action`・`/api/game/battle`（REST）で送信し、サーバが全接続へブロードキャストする。接続状況・手番待ちバナーを表示。
- **離脱**: オンライン時の TOP ボタンは `onForceBack`（ルールロビーへ戻る）。

### 1.1.5 CPU 対戦（`vsCpu`）
- **単一クライアント・REST のみ**（WS 不使用）。人間=p1、CPU=p2。`fixedViewer = isOnline || vsCpu` で
  自陣を下側固定・相手(CPU)手札を裏向き・手番ゲート（`isMyTurn`/`isMyDecision`）をオンラインと共通化。
- **導線**: メニュー（`ui/GameStart.tsx` の「CPU 対戦」＋難易度パネル、`onStartCpu`）→ `App.tsx` の `ruleCpu` 状態（`ruleOnline` と並列）→ `RealGame`（`vsCpu`/`cpuDifficulty`）。
- **生成**: ソロ用「VS CPU SETUP」画面で人間(p1)・CPU(p2) のデッキを選び、`apiClient.createGame(p1,p2,{vsCpu,cpuDifficulty,cpuDeck})`。
- **CPU 駆動**: CPU(p2) が行動すべき状況（p2 宛の `pending_request`、または p2 手番）で
  `apiClient.cpuStep(gameId)` を 700ms 間隔でポーリングし、`waiting_for!=='cpu'` になるまで 1 手ずつ
  盤面・`EffectToast`・`ActionLog` へ反映する（`cpuBusyRef` で多重起動防止）。CPU 思考中バナーを表示。
- **離脱**: TOP ボタンは `onBack`（メニューへ戻る）。

### 1.2 対局中の操作（共通）
- 盤面ゾーン操作（手札/場/デッキ/トラッシュ/ライフ/ドン!!）、カードアクション（`ui/CardActionMenu.tsx`／`ui/CardDetailSheet.tsx`）。
- 戦闘フロー：アタック宣言 → ブロック → カウンター → ダメージ。
- ドン!!付与: 2通りの導線がある。①対象（リーダー/キャラ）をタップ→ミニメニュー「ドン!!付与」→枚数選択。②自陣のアクティブドン!!をタップ→付与対象（自リーダー/自キャラ）をハイライト表示し選択→枚数選択。いずれも選んだ枚数だけ `ATTACH_DON` を送る。
- 効果処理：対象選択・任意確認・トリガー解決のオーバーレイ／`ui/CardSelectModal.tsx`。
- 情報確認：`ui/ActionLog.tsx`（効果ログ）、`ui/EffectToast.tsx`（一時トースト）、`ui/InspectOverlay.tsx`。

---

## 2. フリーモード（SandboxGame）/ ロビー

- `screens/SandboxGame.tsx`：ルール強制なしのドラッグ&ドロップ自由盤面。`myPlayerId='both'`（ソロ）／`'p1'|'p2'`（オンライン）。オンラインは `/ws/sandbox/{id}` 購読・`/api/sandbox/*`。
- `screens/RoomLobby.tsx`：フリーモードのルーム一覧・作成・参加（`/api/sandbox/*`）。
- `screens/RuleLobby.tsx`：ルールモードのルーム一覧・作成・参加（`/api/rule/*`）。ホスト=p1、参加=p2。

---

## 3. API クライアント / 状態同期

`src/api/client.ts`（`apiClient`）。

| メソッド | 用途 |
|---|---|
| `createGame`（CPU オプション可） / `sendAction` / `sendBattleAction` | ルールモードの対局生成・アクション・戦闘アクション（`/api/game/*`） |
| `cpuStep` | CPU 対戦で CPU の次の 1 手を進める（`/api/game/cpu/step`）。`{cpu_acted, cpu_event, waiting_for}` を返す |
| `createRuleRoom` / `sendRuleAction` | ルールモードのオンライン ルーム作成・ロビー操作（`/api/rule/*`） |
| `createSandboxGame` / `sendSandboxAction` | フリーモードの盤面操作（`/api/sandbox/*`） |

- `src/game/actions.ts` の `useGameAction` がルールモードのアクション送受信を担う。オンライン時は外部 `game_id`（既存ルーム）を受け取り `createGame` を呼ばない。
- 定数は `shared_constants.json`（バックエンドと共有：`PLAYER_KEYS`／`CARD_PROPERTIES`／`c_to_s_interface` 等）。
- ログは `utils/logger.ts`（バックエンド `/api/log` へ送信）、セッションは `utils/session.ts`。

---

## 4. ファイルマップ（主要）

| パス | 役割 |
|---|---|
| `src/App.tsx` | 画面モード管理・遷移・オンライン接続情報（`ruleOnline`/`sandboxOptions`） |
| `src/ui/GameStart.tsx` | メインメニュー（PLAY 階層ナビ） |
| `src/screens/RealGame.tsx` | ルールモード盤面（ソロ＋オンライン） |
| `src/screens/SandboxGame.tsx` | フリーモード盤面（ソロ＋オンライン） |
| `src/screens/RoomLobby.tsx` / `RuleLobby.tsx` | フリー／ルールのオンライン ロビー |
| `src/screens/DeckBuilder.tsx` | デッキ作成・一覧・カード閲覧 |
| `src/ui/BoardSide.tsx` | ルールモードの盤面描画（`hideHand` で相手手札を裏向き） |
| `src/ui/CardRenderer.tsx` | カード1枚の Pixi 描画（`is_face_up===false` で裏面） |
| `src/ui/CardActionMenu.tsx` / `CardDetailSheet.tsx` / `CardSelectModal.tsx` | カード操作UI・詳細・選択モーダル |
| `src/ui/ActionLog.tsx` / `EffectToast.tsx` / `InspectOverlay.tsx` | ログ・トースト・インスペクト |
| `src/api/client.ts` / `types.ts` / `api.config.ts` | API クライアント・型・接続先 |
| `src/game/actions.ts` / `types.ts` / `localActionHandler.ts` | アクションフック・型・フリーモードのローカル処理 |
| `shared_constants.json` | バックエンドと共有する定数 |

---

## 5. 検証

フロントエンドは型・lint・ビルドで検証する（専用テストスイートは持たない）。

```bash
npm ci
npx tsc -b      # 型チェック
npx eslint .    # lint
npx vite build  # 本番ビルド
```

オンライン対戦の動作確認は、ルールロビーで対戦開始 → 2クライアントで状態同期・相手手札の裏向き表示・
手番ゲート（相手の手番では操作不可）・場6体目の強制トラッシュ選択を確認する。

---

## 6. 関連ドキュメント
- ユーザ目線の機能分類: [`docs/user-feature-classification.md`](user-feature-classification.md)
- バックエンド仕様: `opcg-sim-backend/docs/SPEC.md`（コアルール・オンライン対戦・効果システム）
- バックエンドのテスト仕様: `opcg-sim-backend/docs/TEST_SPEC.md`
