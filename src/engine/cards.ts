// ============================================================
// cards.ts — 測試卡牌資料
// 一組 10 張數值平衡的卡，供分析台測試各種翻面情境。
// 注意：這是測試資料，非真實 FF14 卡牌數值。
// 邊值範圍 1~10（10 即遊戲中的 A）。
// ============================================================

import type { Card } from './types';

// 卡牌庫。edges 順序：top, right, bottom, left。
export const CARD_POOL: Card[] = [
  { id: 1, name: '陸行鳥', stars: 1, edges: { top: 5, right: 5, bottom: 4, left: 6 } },
  { id: 2, name: '莫古力', stars: 1, edges: { top: 7, right: 3, bottom: 5, left: 5 } },
  { id: 3, name: '仙人薔薇', stars: 2, edges: { top: 4, right: 8, bottom: 6, left: 2 } },
  { id: 4, name: '骷髏戰士', stars: 2, edges: { top: 6, right: 4, bottom: 7, left: 5 } },
  { id: 5, name: '哥布林', stars: 1, edges: { top: 3, right: 6, bottom: 5, left: 7 } },
  { id: 6, name: '巨型蟻獅', stars: 3, edges: { top: 6, right: 4, bottom: 5, left: 5 } },
  { id: 7, name: '寶箱怪', stars: 2, edges: { top: 5, right: 7, bottom: 4, left: 6 } },
  { id: 8, name: '蜥蜴人', stars: 3, edges: { top: 8, right: 2, bottom: 6, left: 4 } },
  { id: 9, name: '食人魔', stars: 2, edges: { top: 4, right: 6, bottom: 5, left: 7 } },
  { id: 10, name: '飛龍', stars: 4, edges: { top: 7, right: 5, bottom: 6, left: 3 } },
];

// 依 id 取卡（找不到回傳 undefined）。
export function getCardById(id: number): Card | undefined {
  return CARD_POOL.find((c) => c.id === id);
}