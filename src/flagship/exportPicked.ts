/**
 * 「出場候補」に選んだ開催を、スマートフォンで見やすい単体 HTML として書き出す。
 *
 * 選択そのものは保存しない（画面内の一時状態・ユーザ決定）。持ち出したいときに
 * この HTML を生成し、新しいタブで開く（その場で見る／共有）か、ファイルとして
 * 保存する（オフラインで見る・AirDrop 等で端末へ渡す）。
 *
 * 生成物は **完全に自己完結**（外部 CSS / スクリプト / 画像を参照しない）にする。
 * 保存した HTML をオフラインの iPhone で開いてもレイアウトが崩れないようにするため。
 */

import { kindBadge, kindShort } from './seriesDiscovery';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 書き出しに必要な開催の項目。一覧の `MergedEvent` がそのまま渡せる形にしている
 * （`applicants` は画面側で override 反映済みの値を入れて渡す）。
 */
export interface ExportEvent {
  id: number;
  /** 開催日時 "2026-07-05T13:00:00"（現地時刻） */
  startDatetime: string;
  /** 開催日 "2026-07-05" */
  date: string;
  store: string;
  pref: string;
  capacity: number | null;
  /** 店舗の X アカウント URL（未登録なら空文字） */
  snsUrl: string;
  /** 応募締切（RFC3339、無ければ空文字） */
  applyEnd: string;
  /** 申込人数（募集中のみ意味を持つ。未取得は null） */
  applicants: number | null;
  /** 大会種別名（フラッグシップバトル / エクストラグランドバトル） */
  kind: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** href に埋めてよい URL だけを通す（javascript: 等を弾く）。 */
function safeUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  return esc(url);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "2026-07-05" → "7月5日(土)" */
function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`;
}

/** 応募締切（RFC3339）→ "7/1(火) 23:59"。解釈できなければ null。 */
function deadlineLabel(applyEnd: string): string | null {
  if (!applyEnd) return null;
  const d = new Date(applyEnd);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 応募締切を過ぎているか（締切不明は「過ぎていない」扱い＝注意書きを出さない）。 */
function isClosed(applyEnd: string, now: Date): boolean {
  if (!applyEnd) return false;
  const t = new Date(applyEnd).getTime();
  return !Number.isNaN(t) && t <= now.getTime();
}

function chip(label: string, value: string): string {
  return `<div class="chip"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;
}

function card(e: ExportEvent, now: Date): string {
  const time = e.startDatetime.slice(11, 16) || '—';
  const closed = isClosed(e.applyEnd, now);
  const deadline = deadlineLabel(e.applyEnd);
  const chips = [
    chip('都道府県', e.pref || '—'),
    chip('定員', e.capacity == null ? '—' : `${e.capacity}`),
  ];
  // 申込人数は募集中にしか意味が無い（締切後の値は残るが「現在の申込」ではない）。
  if (!closed && e.applicants != null) chips.push(chip('申込', `${e.applicants}`));
  if (deadline) chips.push(chip(closed ? '締切済' : '申込締切', deadline));

  const sns = safeUrl(e.snsUrl);
  const link = sns ? `<a class="x" href="${sns}" target="_blank" rel="noopener noreferrer">店舗X ↗</a>` : '';

  return `      <article class="card${closed ? ' closed' : ''}">
        <div class="head">
          <span class="time">${esc(time)}</span>
          <span class="kind k-${esc(kindBadge(e.kind))}">${esc(kindShort(e.kind))}</span>
          ${link}
        </div>
        <h3 class="store">${esc(e.store)}</h3>
        <div class="chips">${chips.join('')}</div>
      </article>`;
}

const STYLE = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 16px 14px calc(28px + env(safe-area-inset-bottom));
      background: #0b0908; color: #f0e6d2;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
      font-size: 16px; line-height: 1.6; -webkit-text-size-adjust: 100%;
    }
    header { border-bottom: 1px solid #2e261c; padding-bottom: 12px; margin-bottom: 4px; }
    .eyebrow { margin: 0; font-size: 11px; letter-spacing: .18em; color: #f1c40f; font-weight: 600; }
    h1 { margin: 2px 0 4px; font-size: 22px; letter-spacing: .02em; }
    .sub { margin: 0; font-size: 12px; color: #6f6553; }
    h2 {
      position: sticky; top: 0; z-index: 1; margin: 18px 0 8px;
      padding: 6px 10px; border-radius: 6px; background: #1e1812;
      font-size: 13px; font-weight: 700; letter-spacing: .06em; color: #f1c40f;
    }
    .card {
      background: #16120e; border: 1px solid #2e261c; border-radius: 10px;
      padding: 12px 14px; margin-bottom: 8px;
    }
    .card.closed { opacity: .62; }
    .head { display: flex; align-items: center; gap: 8px; }
    .time { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
    .kind { border: 1px solid #2e261c; border-radius: 4px; font-size: 11px; padding: 1px 7px; white-space: nowrap; }
    .k-fs { color: #d4b46a; }
    .k-ex { color: #8fb8d8; border-color: #27394a; }
    .k-qual { color: #b491d4; border-color: #35294a; }
    .x {
      margin-left: auto; color: #a89a80; text-decoration: none; white-space: nowrap;
      border: 1px solid #2e261c; border-radius: 6px; padding: 6px 10px; font-size: 13px;
    }
    .store { margin: 6px 0 8px; font-size: 17px; font-weight: 600; line-height: 1.4; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      display: inline-flex; align-items: baseline; gap: 6px;
      background: #1e1812; border: 1px solid #2e261c; border-radius: 999px; padding: 3px 11px;
    }
    .chip .k { font-size: 11px; color: #6f6553; }
    .chip .v { font-size: 13px; font-variant-numeric: tabular-nums; }
    footer { margin-top: 22px; font-size: 11px; color: #6f6553; line-height: 1.7; }
    @media (min-width: 640px) { body { max-width: 620px; margin: 0 auto; } }
    @media print {
      body { background: #fff; color: #111; }
      h2 { position: static; background: #eee; color: #333; }
      .card { background: #fff; border-color: #bbb; }
      .chip { background: #f4f4f4; border-color: #ddd; }
      .chip .k, .sub, footer { color: #555; }
      .x { display: none; }
    }`;

/**
 * 選択された開催を、日付見出しつきのカード一覧 HTML（自己完結）に整形する。
 * 開催日時の昇順に並べ替える（呼び出し側の絞り込み状態に依存しない）。
 */
export function buildPickedHtml(
  events: ExportEvent[],
  opts: { monthLabel: string; now: Date },
): string {
  const sorted = [...events].sort((a, b) => a.startDatetime.localeCompare(b.startDatetime));
  const sections: string[] = [];
  let lastDate = '';
  for (const e of sorted) {
    if (e.date !== lastDate) {
      if (lastDate) sections.push('    </section>');
      lastDate = e.date;
      sections.push(`    <section>\n      <h2>${esc(dayLabel(e.date))}</h2>`);
    }
    sections.push(card(e, opts.now));
  }
  if (lastDate) sections.push('    </section>');

  const n = opts.now;
  const stamp = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}`;
  const title = `出場候補${opts.monthLabel ? ` — ${opts.monthLabel}` : ''}`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<style>${STYLE}
</style>
</head>
<body>
  <header>
    <p class="eyebrow">OPCG SIM — FLAGSHIP</p>
    <h1>出場候補</h1>
    <p class="sub">${esc(opts.monthLabel || '')}${opts.monthLabel ? ' ・ ' : ''}${sorted.length}件 ・ ${esc(stamp)} 時点</p>
  </header>
  <main>
${sections.join('\n')}
  </main>
  <footer>
    開催データは BANDAI TCG+ の公開情報から取得したもの。申込人数・申込締切は書き出した時点の値で、
    以降の変動は反映されない。応募の可否は必ず TCG+ の開催ページで確認すること。
  </footer>
</body>
</html>
`;
}

/** 書き出しファイル名（`flagship-picks-YYYYMMDD.html`）。 */
export function pickedFilename(now: Date): string {
  return `flagship-picks-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.html`;
}

/**
 * 新しいタブに直接書き出して表示する。iPhone の Safari でもその場で読める
 * （共有・ホーム画面追加・PDF 保存はブラウザの共有シートに任せる）。
 * ポップアップがブロックされた場合は false を返す（呼び出し側で保存へ誘導する）。
 */
export function openPickedHtml(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/** HTML ファイルとして保存する（オフライン閲覧・端末間の受け渡し用）。 */
export function downloadPickedHtml(html: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
