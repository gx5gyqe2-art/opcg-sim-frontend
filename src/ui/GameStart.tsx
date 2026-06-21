import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { API_CONFIG } from '../api/api.config';
import './GameUI.css'; 
import { prefetchAllCardImages } from '../utils/imageAssets';

interface GameStartProps {
  onStart: (
    p1: string, 
    p2: string, 
    mode?: 'normal' | 'sandbox', 
    sandboxOptions?: { role: 'both' | 'p1' | 'p2', room_name?: string, gameId?: string }
  ) => void;
  onStartCpu: (difficulty: 'easy' | 'normal' | 'hard' | 'expert') => void;
  onDeckBuilder: () => void;
  onCardList: () => void;
  onLobby: () => void;
  onRuleLobby: () => void;
}

const GameStart: React.FC<GameStartProps> = ({ onStart, onStartCpu, onDeckBuilder, onCardList, onLobby, onRuleLobby }) => {
  const [downloadProgress, setDownloadProgress] = useState<{current: number, total: number} | null>(null);

  // PLAYメニューの階層ナビ: root → mode(フリー/ルール) → match(ソロ/オンライン対戦)
  const [playStep, setPlayStep] = useState<'root' | 'mode' | 'match'>('root');
  const [playMode, setPlayMode] = useState<'free' | 'rule'>('free');
  // ルールモードの CPU 対戦: 難易度選択パネルの表示。
  const [cpuPick, setCpuPick] = useState(false);

  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [contentScale, setContentScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  const isMobile = windowSize.width < 768;

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (contentRef.current) {
      const HEADER_HEIGHT = 60;
      const BOTTOM_PADDING = 20;
      const availableHeight = windowSize.height - HEADER_HEIGHT - BOTTOM_PADDING;
      const contentHeight = contentRef.current.scrollHeight;

      if (contentHeight > availableHeight) {
        const newScale = availableHeight / contentHeight;
        setContentScale(newScale);
      } else {
        setContentScale(1);
      }
    }
  }, [windowSize, isMobile, playStep, playMode]);

  // ▼▼▼ 修正: モーダル表示ロジックを削除し、直接 onStart を呼ぶ形に戻しました ▼▼▼
  const handleStartWithLog = (
    mode: 'normal' | 'sandbox',
    sandboxOptions?: { role: 'both' | 'p1' | 'p2', room_name?: string }
  ) => {
    // デッキIDは空文字で渡す（Sandbox側で選択させるため）
    onStart('', '', mode, sandboxOptions);
  };

  const handleCacheImages = async () => {
    if (!confirm("全てのカード画像をダウンロードしますか？\n(初回のみ通信量が発生します。Wi-Fi推奨)")) return;
    try {
      setDownloadProgress({ current: 0, total: 0 });
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/cards`);
      const data = await res.json();
      
      if (data.success && Array.isArray(data.cards)) {
        setDownloadProgress({ current: 0, total: data.cards.length });
        await prefetchAllCardImages(data.cards, (current, total) => {
          setDownloadProgress({ current, total });
        });
        alert("画像のダウンロードが完了しました。\nオフラインでも快適に動作します。");
      }
    } catch {
            alert("カードリストの取得に失敗しました");
          } finally {
      setDownloadProgress(null);
    }
  };

  const styles = useMemo(() => ({
    container: {
      height: '100vh', width: '100%', 
      background: 'radial-gradient(circle at center, #2c3e50 0%, #000000 100%)', 
      display: 'flex', flexDirection: 'column' as const, 
      alignItems: 'center', 
      color: '#f0e6d2', fontFamily: '"Times New Roman", serif', 
      position: 'relative' as const, 
      overflow: 'hidden' as const,
      boxSizing: 'border-box' as const
    },
    bgOverlay: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, 
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 2px, transparent 2px, transparent 20px)', 
      pointerEvents: 'none' as const, zIndex: 0
    },
    header: {
      width: '100%', display: 'flex', justifyContent: 'flex-end',
      padding: '10px 20px', zIndex: 10, flexShrink: 0, height: '60px', boxSizing: 'border-box' as const
    },
    scaleWrapper: {
      flex: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden', zIndex: 1
    },
    scaledContent: {
      width: '100%', maxWidth: '900px', padding: '0 20px', boxSizing: 'border-box' as const,
      transform: `scale(${contentScale})`, transformOrigin: 'top center', transition: 'transform 0.1s ease-out',
      display: 'flex', flexDirection: 'column' as const, gap: '30px'
    },
    title: {
      fontSize: isMobile ? '40px' : '60px', fontWeight: '900', textAlign: 'center' as const, 
      margin: '0 0 10px 0',
      background: 'linear-gradient(to bottom, #ffd700, #b8860b, #8b4513)', 
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', 
      filter: 'drop-shadow(0 4px 0px rgba(0,0,0,0.8))', letterSpacing: '4px', textTransform: 'uppercase' as const
    },
    section: { display: 'flex', flexDirection: 'column' as const, gap: '15px' },
    sectionTitle: {
      fontSize: '18px', color: '#8b8b8b', borderBottom: '1px solid #444', paddingBottom: '5px', marginBottom: '5px',
      textTransform: 'uppercase' as const, letterSpacing: '2px'
    },
    subGroupTitle: {
      fontSize: '13px', color: '#bbb', letterSpacing: '1px', margin: '8px 0 2px 0', fontWeight: 'bold' as const,
    },
    backBtn: {
      alignSelf: 'flex-start' as const, marginTop: '10px', background: 'transparent',
      border: '1px solid #7f8c8d', color: '#bbb', padding: '8px 18px', borderRadius: '20px',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px'
    },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
    menuCard: (color: string) => ({
      background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}`, borderRadius: '8px', padding: '20px',
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '10px',
      cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', minHeight: '100px'
    }),
    cardLabel: { fontSize: '18px', fontWeight: 'bold', color: '#eee', textAlign: 'center' as const },
    cardDesc: { fontSize: '12px', color: '#aaa', textAlign: 'center' as const },
    dlBtn: {
      background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #555', color: '#888',
      fontSize: '11px', padding: '6px 12px', borderRadius: '20px',
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '5px'
    },
    modalOverlay: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000,
      display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)'
    },
    modalPanel: {
      background: '#2c3e50', padding: '30px', borderRadius: '12px',
      border: '2px solid #7f8c8d', width: '90%', maxWidth: '500px',
      display: 'flex', flexDirection: 'column' as const, gap: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    },
    modalTitle: {
      color: '#f1c40f', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' as const,
      borderBottom: '1px solid #7f8c8d', paddingBottom: '10px', marginBottom: '10px'
    },
    select: {
      width: '100%', padding: '12px', background: '#2a1a1a', color: '#f0e6d2',
      border: '1px solid #5d4037', borderRadius: '4px', fontSize: '16px', marginTop: '5px',
      boxSizing: 'border-box' as const 
    },
    actionBtn: (primary: boolean) => ({
      flex: 1, padding: '12px', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
      border: primary ? 'none' : '1px solid #95a5a6',
      background: primary ? '#e67e22' : 'transparent',
      color: primary ? '#fff' : '#95a5a6'
    })
  }), [isMobile, contentScale]);

  const MenuCard = ({ label, desc, onClick, color = '#7f8c8d', disabled = false, badge }: { label: string, desc: string, onClick: () => void, color?: string, disabled?: boolean, badge?: string }) => (
    <div
      style={{ ...styles.menuCard(color), ...(disabled ? { opacity: 0.45, cursor: 'not-allowed', borderStyle: 'dashed' as const } : {}) }}
      onClick={disabled ? undefined : onClick}
      role="button"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={disabled ? undefined : "hover-scale"}
      onMouseOver={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
      onMouseOut={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
    >
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardDesc}>{desc}</div>
      {badge && <div style={{ fontSize: '11px', color: '#f1c40f', border: '1px solid #f1c40f', borderRadius: '10px', padding: '1px 8px', marginTop: '4px' }}>{badge}</div>}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.bgOverlay}></div>
      
      <div style={styles.header}>
        <button onClick={handleCacheImages} disabled={!!downloadProgress} style={styles.dlBtn} title="全てのカード画像をダウンロードしてキャッシュします">
          {downloadProgress ? `DL中: ${Math.floor((downloadProgress.current / downloadProgress.total) * 100)}%` : <><span>📥</span> 画像一括DL</>}
        </button>
      </div>

      <div style={styles.scaleWrapper}>
        <div ref={contentRef} style={styles.scaledContent}>
          <div style={styles.title}>OPCG SIM</div>

          {/* === 第1階層: PLAY 1ボタン + Deck & Cards === */}
          {playStep === 'root' && (
            <>
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Play</div>
                <div style={styles.grid}>
                  <MenuCard
                    label="▶ PLAY"
                    desc="ゲームを始める"
                    onClick={() => { setPlayStep('mode'); }}
                    color="#f1c40f"
                  />
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Deck & Cards</div>
                <div style={styles.grid}>
                  <MenuCard
                    label="デッキ作成 / 一覧"
                    desc="Deck Builder"
                    onClick={() => {
                      onDeckBuilder();
                    }}
                    color="#3498db"
                  />
                  <MenuCard
                    label="カードリスト"
                    desc="Card Catalog"
                    onClick={() => {
                      onCardList();
                    }}
                    color="#e67e22"
                  />
                </div>
              </div>
            </>
          )}

          {/* === 第2階層: フリー / ルール の選択 === */}
          {playStep === 'mode' && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Play — モードを選ぶ</div>
              <div style={styles.grid}>
                <MenuCard
                  label="フリーモード"
                  desc="自由に操作（ルールなし）"
                  onClick={() => { setPlayMode('free'); setPlayStep('match'); }}
                  color="#2ecc71"
                />
                <MenuCard
                  label="ルールモード"
                  desc="公式ルールで自動進行"
                  onClick={() => { setPlayMode('rule'); setPlayStep('match'); }}
                  color="#e74c3c"
                />
              </div>
              <button style={styles.backBtn} onClick={() => setPlayStep('root')}>← 戻る</button>
            </div>
          )}

          {/* === 第3階層: ソロプレイ / オンライン対戦 / CPU対戦 の選択 === */}
          {playStep === 'match' && !cpuPick && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                {playMode === 'free' ? 'フリーモード' : 'ルールモード'} — プレイを選ぶ
              </div>
              <div style={styles.grid}>
                <MenuCard
                  label="ソロプレイ"
                  desc={playMode === 'free' ? 'Free · Solo' : 'Rule · Solo'}
                  onClick={() => {
                    if (playMode === 'free') handleStartWithLog('sandbox', { role: 'both' });
                    else handleStartWithLog('normal');
                  }}
                  color="#2ecc71"
                />
                <MenuCard
                  label="オンライン対戦"
                  desc={playMode === 'free' ? 'Free · Online' : 'Rule · Online'}
                  onClick={() => {
                    if (playMode === 'free') { onLobby(); }
                    else { onRuleLobby(); }
                  }}
                  color="#16a085"
                />
                {/* CPU 対戦はルールモードのみ */}
                {playMode === 'rule' && (
                  <MenuCard
                    label="CPU対戦"
                    desc="Rule · vs CPU"
                    onClick={() => { setCpuPick(true); }}
                    color="#e67e22"
                  />
                )}
              </div>
              <button style={styles.backBtn} onClick={() => setPlayStep('mode')}>← 戻る</button>
            </div>
          )}

          {/* === CPU対戦: 難易度選択 === */}
          {playStep === 'match' && cpuPick && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>CPU対戦 — 難易度を選ぶ</div>
              <div style={styles.grid}>
                <MenuCard
                  label="かんたん"
                  desc="フェア · 公開情報のみ"
                  onClick={() => { onStartCpu('easy'); }}
                  color="#2ecc71"
                />
                <MenuCard
                  label="ふつう"
                  desc="リーダー推測 · 多手先読み"
                  onClick={() => { onStartCpu('normal'); }}
                  color="#f39c12"
                />
                <MenuCard
                  label="つよい"
                  desc="最強 · 全力先読み"
                  onClick={() => { onStartCpu('hard'); }}
                  color="#e74c3c"
                />
                <MenuCard
                  label="エキスパート"
                  desc="MCTS · 公平(手札を見ない)"
                  onClick={() => { onStartCpu('expert'); }}
                  color="#9b59b6"
                />
              </div>
              <button style={styles.backBtn} onClick={() => setCpuPick(false)}>← 戻る</button>
            </div>
          )}
        </div>
      </div>


      <style>{`
        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  );
};

export default GameStart;
