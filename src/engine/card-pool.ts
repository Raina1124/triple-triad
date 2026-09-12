// ============================================================
// card-pool.ts — 對外提供「已合併中文名」的卡池
//
// 把自動產生的 cards-data.ts（英文名）與手動維護的 cards-zh.ts
// （中文名對照）合併，輸出一份每張卡都帶上 nameZh（若有對照）的卡池。
// 整個 app 都從這裡取卡池，而非直接用 cards-data，這樣中文名一處生效。
// ============================================================

import type { Card } from './types'
import { CARD_POOL as RAW_POOL } from './cards-data'
import { CARD_NAMES_ZH } from './cards-zh'

// 15 張主角特殊卡的 id（它們的 No. 與普通卡 No.1~15 撞號）。
// 這些直接用 id 精確對應中文名，不受 No. 對照影響。
// id 對照：No.1~13 → id 68~80；No.14 → 252；No.15 → 405。
const HERO_CARD_ZH: Record<number, string> = {
  68: '光之戰士', // Warrior of Light
  69: '弗里奧尼爾', // Firion
  70: '洋蔥騎士', // Onion Knight
  71: '塞西爾', // Cecil Harvey
  72: '巴茲', // Bartz Klauser
  73: '蒂娜·布蘭福德', // Terra Branford
  74: '克勞德·史特萊夫', // Cloud Strife
  75: '史克爾·里昂哈特', // Squall Leonhart
  76: '吉坦', // Zidane Tribal
  77: '提達', // Tidus
  78: '香托托', // Shantotto
  79: '梵恩', // Vaan
  80: '雷光', // Lightning
  252: '諾克提斯·路希斯·切拉姆', // Noctis Lucis Caelum
  405: '克萊夫·羅茲菲德', // Clive Rosfield
}

// 撞號的 No.（這 15 個 No. 有兩張卡，用 No. 對照時只套用到普通卡）。
const COLLIDING_NOS = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
// 主角卡的 id 集合（用 No. 對照時要跳過這些）。
const HERO_IDS = new Set<number>(Object.keys(HERO_CARD_ZH).map(Number))

// 合併中文名：
//   1. 主角卡（15 張）→ 用內建的 HERO_CARD_ZH（依 id）。
//   2. 其他卡 → 用 cards-zh.ts 的 No. 對照（你用遊戲看得到的 No. 填）。
//      撞號的 No. 只套用到普通卡（跳過主角卡 id），避免一名套兩卡。
export const CARD_POOL: Card[] = RAW_POOL.map((c) => {
  // 主角卡優先用內建中文名。
  const heroZh = HERO_CARD_ZH[c.id]
  if (heroZh) return { ...c, nameZh: heroZh }

  // 其他卡用 No. 對照。
  if (c.cardNo != null) {
    const zh = CARD_NAMES_ZH[c.cardNo]
    // 撞號的 No.：只有「非主角卡」（普通卡）才套用。
    if (zh && (!COLLIDING_NOS.has(c.cardNo) || !HERO_IDS.has(c.id))) {
      return { ...c, nameZh: zh }
    }
  }
  return c
})

// 依 id 取卡。
export function getCardById(id: number): Card | undefined {
  return CARD_POOL.find((c) => c.id === id)
}

// ---------- 未知卡的估值基準 ----------
// 用於 expectimax 的輕量近似：搜尋時把對手未知卡替換成這張代表卡。
// 基準＝「4 星卡」四邊值的平均。理由：玩家牌組規則限制強牌多為 4★
// （5★ 最多 1 張），所以 4★ 是對手「可能的強牌」的合理代表；NPC 雖
// 不受限，但 4★ 仍是中上威脅的好估計。比全卡池百分位更有依據。
function computeEstimateEdge(): number {
  const vals: number[] = []
  for (const c of CARD_POOL) {
    if (c.stars === 4) {
      vals.push(c.edges.top, c.edges.right, c.edges.bottom, c.edges.left)
    }
  }
  if (vals.length === 0) {
    // 沒有 4 星卡的保險：退回全卡池平均。
    const all: number[] = []
    for (const c of CARD_POOL) {
      all.push(c.edges.top, c.edges.right, c.edges.bottom, c.edges.left)
    }
    if (all.length === 0) return 6
    const avg = all.reduce((a, b) => a + b, 0) / all.length
    return Math.max(1, Math.min(10, Math.round(avg)))
  }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.max(1, Math.min(10, Math.round(avg)))
}

// 估值基準邊值（啟動時算一次）。
export const STRONG_EDGE: number = computeEstimateEdge()

// 產生一張「估計卡」：四邊都用估值基準，代表對手的未知牌。
// 搜尋時用它替換未知卡，讓建議不再把未知卡當全 1 弱牌。
export function makeEstimateCard(id: number): Card {
  const v = STRONG_EDGE as Card['edges']['top']
  return {
    id,
    name: '估計',
    stars: 1,
    edges: { top: v, right: v, bottom: v, left: v },
  }
}
