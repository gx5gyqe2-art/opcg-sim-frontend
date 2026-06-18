import { useEffect, useRef, useState } from 'react';
import { LAYOUT_PARAMS } from '../../layout/layout.config';

export interface PhaseBannerData {
  id: number;
  text: string;
}

// ターン/フェーズ交代の一時バナー（CSS オーバーレイ）。
// banner.id が変わるたびにスライドインし、約 1.3 秒で自動的に消える。
export function PhaseBanner({ banner }: { banner: PhaseBannerData | null }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!banner) return;
    // 効果本体で同期 setState せず、次フレームで可視化（スライドイン）。
    const raf = requestAnimationFrame(() => setVisible(true));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 1300);
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [banner?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- id 変化時のみ起動する意図

  if (!banner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '38%',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: LAYOUT_PARAMS.Z_INDEX.SPOTLIGHT,
      }}
    >
      <div
        style={{
          padding: '10px 30px',
          borderRadius: 999,
          background: LAYOUT_PARAMS.MODAL.PANEL_BG,
          border: LAYOUT_PARAMS.MODAL.BANNER_BORDER,
          color: '#ffe9b0',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1,
          boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.96)',
          transition: 'opacity 260ms ease, transform 260ms ease',
        }}
      >
        {banner.text}
      </div>
    </div>
  );
}
