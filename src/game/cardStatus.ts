import type { BaseCard, CardStatus } from './types';

/**
 * 継続中の状態（API の `statuses[].code`）の表示定義。
 *
 * - short: 盤面のカード下端に出す短いラベル（小さいカードでも読める 2〜4 文字）
 * - label: カード詳細に出す説明
 * - tone : 色分け（restrict=行動制限／protect=耐性・保護／grant=付与／freeze=凍結／negate=効果無効）
 * 凍結・効果無効はカード全体のオーバーレイで出すため、盤面の小ラベルには出さない（overlay=true）。
 */
export type StatusTone = 'restrict' | 'protect' | 'grant' | 'freeze' | 'negate';

export interface StatusView {
  code: string;
  short: string;
  label: string;
  tone: StatusTone;
  overlay?: boolean;
  duration: string;
}

export const STATUS_TONE_COLOR: Record<StatusTone, { hex: number; css: string }> = {
  restrict: { hex: 0xc0392b, css: '#c0392b' },
  protect: { hex: 0x16a085, css: '#16a085' },
  grant: { hex: 0xb7950b, css: '#b7950b' },
  freeze: { hex: 0x2980b9, css: '#2980b9' },
  negate: { hex: 0x7f8c8d, css: '#7f8c8d' },
};

const FIXED: Record<string, Omit<StatusView, 'code' | 'duration'>> = {
  FREEZE: { short: '凍結', label: '凍結（次のリフレッシュでアクティブにならない）', tone: 'freeze', overlay: true },
  EFFECTS_DISABLED: { short: '無効', label: '効果無効', tone: 'negate', overlay: true },
  ATTACK_DISABLE: { short: '攻撃×', label: 'アタックできない', tone: 'restrict' },
  ATTACK_BAN_LEADER: { short: 'L攻撃×', label: 'リーダーにアタックできない', tone: 'restrict' },
  BLOCKER_DISABLED: { short: 'ブロック×', label: '【ブロッカー】を発動できない', tone: 'restrict' },
  CANNOT_REST: { short: 'レスト×', label: 'レストにできない', tone: 'restrict' },
  CANNOT_BE_RESTED_BY_OPP: { short: 'レスト耐', label: '相手の効果でレストにならない', tone: 'protect' },
  CANNOT_BE_RESTED_BY_OPP_LC: { short: 'レスト耐', label: '相手のリーダー・キャラの効果でレストにならない', tone: 'protect' },
  PREVENT_LEAVE: { short: '離脱耐', label: '場を離れない', tone: 'protect' },
  PREVENT_EFFECT_KO: { short: '効果KO耐', label: '効果でKOされない', tone: 'protect' },
  PREVENT_BATTLE_KO: { short: 'バトルKO耐', label: 'バトルでKOされない', tone: 'protect' },
  'KW:ATTACK_ACTIVE': { short: '活性攻撃', label: 'アクティブのキャラにアタックできる', tone: 'grant' },
};

const describeCode = (code: string): Omit<StatusView, 'code' | 'duration'> => {
  if (FIXED[code]) return FIXED[code];
  let m = code.match(/^ATTACK_TAX_DISCARD_(\d+)$/);
  if (m) return { short: `攻撃税${m[1]}`, label: `アタックするには手札${m[1]}枚を捨てる`, tone: 'restrict' };
  m = code.match(/^ATTACK_BAN_CHAR_OCOST_LE_(\d+)$/);
  if (m) return { short: '攻撃制限', label: `元々のコスト${m[1]}以下のキャラにアタックできない`, tone: 'restrict' };
  if (code.startsWith('ATTR:')) {
    const attr = code.slice(5);
    return { short: attr, label: `属性(${attr})を得ている`, tone: 'grant' };
  }
  if (code.startsWith('KW:')) {
    const kw = code.slice(3);
    return { short: kw, label: `【${kw}】を得ている`, tone: 'grant' };
  }
  // 未知の状態も黙って捨てない（コードのまま見せる）。
  return { short: code, label: code, tone: 'restrict' };
};

/** 期間の表示。`turnCount` は現在のターン数（UNTIL_NEXT_TURN_END の「このターン／次のターン」判定に使う）。 */
export const describeDuration = (s: CardStatus, turnCount?: number): string => {
  switch (s.duration) {
    case 'THIS_TURN': return 'このターン中';
    case 'THIS_BATTLE': return 'このバトル中';
    case 'UNTIL_NEXT_TURN_END':
      return s.expire_turn !== undefined && turnCount !== undefined && s.expire_turn <= turnCount
        ? 'このターン終了まで' : '次のターン終了まで';
    case 'PERMANENT': return '場にいる間';
    case 'PASSIVE': return '条件を満たす間';
    case 'NEXT_REFRESH': return '次のリフレッシュまで';
    default: return '';
  }
};

/** カードの継続中の状態を表示用に並べる（同じ code は 1 つにまとめる）。 */
export const getStatusViews = (card: Partial<BaseCard> | null | undefined, turnCount?: number): StatusView[] => {
  const seen = new Set<string>();
  const out: StatusView[] = [];
  for (const s of card?.statuses ?? []) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    out.push({ code: s.code, ...describeCode(s.code), duration: describeDuration(s, turnCount) });
  }
  // 旧 API（statuses 無し）でも凍結・効果無効は従来のフラグから出す。
  if (card?.is_frozen && !seen.has('FREEZE')) out.push({ code: 'FREEZE', ...FIXED.FREEZE, duration: describeDuration({ code: 'FREEZE', duration: 'NEXT_REFRESH' }) });
  if (card?.ability_disabled && !seen.has('EFFECTS_DISABLED')) out.push({ code: 'EFFECTS_DISABLED', ...FIXED.EFFECTS_DISABLED, duration: '' });
  return out;
};

export const hasStatus = (card: Partial<BaseCard> | null | undefined, code: string): boolean =>
  !!card?.statuses?.some(s => s.code === code);
