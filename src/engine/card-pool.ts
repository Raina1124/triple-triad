// ============================================================
// card-pool.ts — 對外提供「已合併中文名」的卡池
//
// 把自動產生的 cards-data.ts（英文名）與手動維護的 cards-zh.ts
// （中文名對照）合併，輸出一份每張卡都帶上 nameZh（若有對照）的卡池。
// 整個 app 都從這裡取卡池，而非直接用 cards-data，這樣中文名一處生效。
// ============================================================

import type { Card, Rules } from './types'
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

// 逆轉規則下的估計卡邊值。逆轉時數字小的贏，用 6 等於把對手當成弱牌。
//
// 成對量測（2026-11，開局空格 9、同一批局面比較不同邊值；代價＝建議著手比
// 真正最佳手少拿幾張卡，高估＝自報分數減實際結果；我方全 1★）：
//                       邊值 6           邊值 3           邊值 1
//   對手全 1★（54 局）  代價 0.89 高估 +9.0  代價 0.59 高估 +3.9  代價 0.63 高估 −1.8
//   對手平常牌組（60 局）代價 0.67 高估 +5.3  代價 0.33 高估 +0.4  代價 1.13 高估 −4.9
// 3 對兩種對手都比 6 好（成對差 +0.30 ± 0.13、+0.20 ± 0.18）；1 對上沒換牌的
// 對手反而更差。開局還不知道對手有沒有換牌，所以取 3。
//
// 同一批量測也重看了一般規則要不要把 6 改成 8：8 的自報分數幾乎不再偏高
// （+3.5~+4.2 → −0.3~−0.7），但建議著手變差（成對差 −0.33 ± 0.14、−0.33 ± 0.20，
// 54 局），所以一般規則維持 6。開局分數偏高是已知現象，說明面板有寫。
export const REVERSE_ESTIMATE_EDGE = 3

// ---------- 顯示用的估計分數 ----------
// 上面的邊值是拿來「選著手」的。用它算出來的分數偏高很多（一般規則開局
// 平均高估 3~5 張），所以畫面上的分數另外換一個邊值，對已選好的著手重算一次。
// 著手不變，只換顯示的數字。
//
// 量測（2026-11，著手用 6 選，比較不同邊值重算的分數與實際結果的差；
// 前一格是平均偏差，正值＝樂觀，後一格是平均絕對誤差）：
//                                     邊值 6         邊值 7         邊值 8
//   無規則、對手平常牌組、開局（30 局）  +5.3 / 5.3    +1.5 / 1.5    −1.1 / 1.3
//   無規則、對手隨機牌組、開局（30 局）  +4.1 / 4.1    +0.4 / 0.7    −2.1 / 2.1
//   無規則、對手平常牌組、後手（30 局）  +4.3 / 4.3    +1.2 / 1.2    −1.4 / 1.4
//   無規則、對手隨機牌組、後手（30 局）  +2.9 / 2.9    +0.3 / 0.9    −2.5 / 2.5
//   同數＋加算、對手平常牌組、開局（24 局）+4.7 / 4.7  +2.1 / 2.1    +0.6 / 1.3
// 沒有同數／加算時 7 最準；有同數＋加算時 8 最準（只量了兩者同時開啟的情況，
// 只開其中一個也用 8）。
//
// 逆轉維持用 REVERSE_ESTIMATE_EDGE 本身：準不準取決於對手有沒有針對逆轉換牌，
// 開局時無從得知（量測：對手全 1★ 時邊值 3 高估 +3.9、邊值 2 只差 +0.1；
// 對手沒換牌時邊值 3 只差 +0.4、邊值 2 低估 −3.4），換哪個都只是押一邊。
export function estimateDisplayEdge(rules: Rules): number {
  if (rules.reverse) return REVERSE_ESTIMATE_EDGE
  return rules.same || rules.plus ? 8 : 7
}

// 產生一張四邊都是 edge 的估計卡。
export function estimateCardWithEdge(id: number, edge: number): Card {
  const v = edge as Card['edges']['top']
  return {
    id,
    name: '估計',
    stars: 1,
    edges: { top: v, right: v, bottom: v, left: v },
  }
}

// 產生一張「估計卡」：四邊都用估值基準，代表對手的未知牌。
// 搜尋時用它替換未知卡，讓建議不再把未知卡當全 1 弱牌。
// reverse：本局是否為逆轉規則（見 REVERSE_ESTIMATE_EDGE）。
export function makeEstimateCard(id: number, reverse = false): Card {
  return estimateCardWithEdge(id, reverse ? REVERSE_ESTIMATE_EDGE : STRONG_EDGE)
}
