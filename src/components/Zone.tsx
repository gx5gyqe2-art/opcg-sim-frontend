import React, { useCallback } from 'react';
import { Graphics, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { COLORS } from '../constants';

interface ZoneProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  isOpponent?: boolean; // 相手エリアかどうか（色を変える等）
  rotation?: number;
}

export const Zone: React.FC<ZoneProps> = ({ 
  x, y, width, height, label, isOpponent = false, rotation = 0 
}) => {
  
  const draw = useCallback((g: any) => {
    g.clear();
    // 枠線の描画
    g.lineStyle(2, COLORS.ZONE_BORDER, 0.5);
    // 塗りつぶし (半透明)
    g.beginFill(isOpponent ? COLORS.OPPONENT_TINT : COLORS.ZONE_FILL, COLORS.ZONE_ALPHA);
    
    // 中心基準で回転させるため、描画はオフセットして行う想定
    // ここでは簡易的に左上基準で描画
    g.drawRect(0, 0, width, height);
    g.endFill();
  }, [width, height, isOpponent]);

  const textStyle = new TextStyle({
    fontSize: 10,
    fill: '#ffffff',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: width,
  });

  return (
    <container x={x} y={y} rotation={rotation}>
      <Graphics draw={draw} />
      {label && (
        <Text 
          text={label} 
          style={textStyle} 
          x={width / 2} 
          y={height / 2} 
          anchor={0.5} 
        />
      )}
    </container>
  );
};
