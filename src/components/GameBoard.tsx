import React from 'react';
import { Container } from '@pixi/react';
import { Zone } from './Zone';
import { SCREEN_WIDTH, SCREEN_HEIGHT, CARD_WIDTH, CARD_HEIGHT, DON_WIDTH, DON_HEIGHT } from '../constants';

export const GameBoard: React.FC = () => {
  // ■ 配置計算 (簡易計算)
  const centerX = SCREEN_WIDTH / 2;
  
  // プレイヤー基準Y座標 (画面下半分)
  const playerBaseY = 500;
  // 相手基準Y座標 (画面上半分) - 点対称っぽく配置
  const oppBaseY = 250; 

  return (
    <Container>
      {/* --- 自分エリア (手前) --- */}
      
      {/* リーダー */}
      <Zone 
        label="My Leader" 
        x={centerX - CARD_WIDTH / 2} 
        y={playerBaseY} 
        width={CARD_WIDTH} 
        height={CARD_HEIGHT} 
      />

      {/* バトル場 (キャラエリア) - リーダーの上に配置 */}
      {[...Array(5)].map((_, i) => (
        <Zone
          key={`my-char-${i}`}
          label={`Char ${i+1}`}
          x={centerX - (2.5 * CARD_WIDTH) - (2 * 5) + (i * (CARD_WIDTH + 5))} // 簡易的な中央寄せ計算
          y={playerBaseY - CARD_HEIGHT - 10}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
        />
      ))}

      {/* ステージ - リーダーの左 */}
      <Zone
        label="Stage"
        x={centerX - CARD_WIDTH / 2 - CARD_WIDTH - 10}
        y={playerBaseY}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
      />

      {/* デッキ - 右下 */}
      <Zone
        label="Deck"
        x={SCREEN_WIDTH - CARD_WIDTH - 10}
        y={SCREEN_HEIGHT - CARD_HEIGHT - 20}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
      />

      {/* トラッシュ - デッキの上 */}
      <Zone
        label="Trash"
        x={SCREEN_WIDTH - CARD_WIDTH - 10}
        y={SCREEN_HEIGHT - (CARD_HEIGHT * 2) - 30}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
      />

      {/* ドン!!デッキ - 左下 */}
      <Zone
        label="Don Deck"
        x={10}
        y={SCREEN_HEIGHT - DON_HEIGHT - 20}
        width={DON_WIDTH}
        height={DON_HEIGHT}
      />

      {/* コストエリア - ドンデッキの上 */}
      <Zone
        label="Cost Area"
        x={10}
        y={SCREEN_HEIGHT - (DON_HEIGHT * 2) - 30}
        width={DON_WIDTH * 5} // 横に広がる想定
        height={DON_HEIGHT}
      />

      {/* 手札 - 最下部 */}
      <Zone
        label="Hand Area"
        x={20}
        y={SCREEN_HEIGHT - CARD_HEIGHT + 10} // 画面外にはみ出し気味に配置
        width={SCREEN_WIDTH - 40}
        height={CARD_HEIGHT}
      />


      {/* --- 相手エリア (奥) - 座標を反転または上部に配置 --- */}
      
      {/* 相手リーダー */}
      <Zone 
        label="Opp Leader" 
        isOpponent
        x={centerX - CARD_WIDTH / 2} 
        y={oppBaseY} 
        width={CARD_WIDTH} 
        height={CARD_HEIGHT} 
      />

      {/* 相手バトル場 */}
      {[...Array(5)].map((_, i) => (
        <Zone
          key={`opp-char-${i}`}
          label={`Opp Char ${i+1}`}
          isOpponent
          x={centerX - (2.5 * CARD_WIDTH) - (2 * 5) + (i * (CARD_WIDTH + 5))}
          y={oppBaseY + CARD_HEIGHT + 10} // リーダーの下側（画面中央寄り）
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
        />
      ))}

      {/* 相手手札 - 最上部 */}
      <Zone
        label="Opp Hand"
        isOpponent
        x={20}
        y={-10}
        width={SCREEN_WIDTH - 40}
        height={CARD_HEIGHT}
      />

      {/* 相手デッキ等 (簡易配置) */}
      <Zone
        label="Opp Deck"
        isOpponent
        x={10}
        y={20}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
      />
      <Zone
        label="Opp Trash"
        isOpponent
        x={10}
        y={20 + CARD_HEIGHT + 10}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
      />
       <Zone
        label="Opp Life"
        isOpponent
        x={centerX + CARD_WIDTH + 10}
        y={oppBaseY}
        width={CARD_WIDTH}
        height={CARD_HEIGHT / 2} // ライフは横向き等で表現
      />

    </Container>
  );
};
