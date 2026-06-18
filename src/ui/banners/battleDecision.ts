// ブロック（SELECT_BLOCKER）とカウンター（SELECT_COUNTER）は、どちらも「防御側の選択」
// として同じ盤面選択 UI に乗るため見分けが付きにくい。アイコン・色・タイトル・効果説明を
// 明確に分けるためのメタ情報をここに集約する（描画は BattleDecisionInfo.tsx）。

export type BattleDecisionKind = 'SELECT_BLOCKER' | 'SELECT_COUNTER';

export interface BattleDecisionMeta {
  kind: BattleDecisionKind;
  icon: string;
  title: string;
  color: string;       // アクセント色（枠・タイトル・ハイライト）
  desc: string;        // 効果の一言説明
  selectHint: string;  // 何をタップすべきか
  passLabel: string;   // 「パス」ボタンの分かりやすい文言
}

const META: Record<BattleDecisionKind, BattleDecisionMeta> = {
  SELECT_BLOCKER: {
    kind: 'SELECT_BLOCKER',
    icon: '🛡',
    title: 'ブロック',
    color: '#4aa3ff', // 青
    desc: 'ブロッカーを選ぶと、攻撃の対象がそのキャラに移ります（攻撃を肩代わり）。',
    selectHint: 'ブロッカーにするキャラをタップ',
    passLabel: 'ブロックしない',
  },
  SELECT_COUNTER: {
    kind: 'SELECT_COUNTER',
    icon: '🔼',
    title: 'カウンター',
    color: '#ffd54d', // 黄（金）
    desc: '手札のカウンターを使うと、このバトル中だけ対象のパワーが上がります。',
    selectHint: '手札のカウンターをタップ',
    passLabel: 'カウンターしない',
  },
};

export const getBattleDecisionMeta = (action: string | undefined | null): BattleDecisionMeta | undefined =>
  action ? META[action as BattleDecisionKind] : undefined;
