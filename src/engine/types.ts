// ============================================================
// types.ts — 幻卡模擬器核心型別定義
// 這個檔案只定義「資料的形狀」，不含任何邏輯。
// engine/ 底下所有其他檔案都會依賴這裡的型別。
// ============================================================

// ---------- 玩家 ----------
// 兩名玩家用顏色區分（FF14 對戰中是紅藍兩方）。
export type Player = 'RED' | 'BLUE'

// ---------- 卡牌邊值 ----------
// 幻卡每張卡四個邊各有一個數字，範圍 1~10。
// 注意：遊戲中顯示的「A」代表數值 10。
export type EdgeValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

// 四個邊的方向。順時針排列（上→右→下→左），
// 方便之後做相鄰格翻面判定時對應方向。
export interface Edges {
  top: EdgeValue
  right: EdgeValue
  bottom: EdgeValue
  left: EdgeValue
}

// ---------- 卡牌 ----------
// 一張幻卡的靜態資料（不含它在棋盤上的狀態）。
export interface Card {
  id: number // 卡牌唯一編號（資料庫內部 id）
  name: string // 卡牌名稱（英文），例如 "Chocobo"
  stars: 1 | 2 | 3 | 4 | 5 // 星級（稀有度）
  edges: Edges // 四邊數值
  // type 之後做「同種族加成（Ascension/Descension）」規則時會用到，
  // 現在先放著，沒啟用該規則時不影響。
  type?: 'none' | 'beastman' | 'primal' | 'garlean' | 'scion'
  cardNo?: number // 遊戲內顯示編號（No.XXX），供搜尋對照
  nameZh?: string // 中文卡名（若有對照資料才填），供搜尋
  unknown?: boolean // 未知卡：對手尚未揭曉的牌，數值待填（顯示為問號卡）
}

// ---------- 棋盤格子 ----------
// 棋盤上的一格：可能是空的，或放了一張卡並歸某一方所有。
export interface Cell {
  card: Card | null // null 表示空格
  owner: Player | null // 卡屬於哪一方；翻面 = 改這個欄位
}

// 棋盤固定 3×3，共 9 格。
// 用一維陣列存（index 0~8），比二維好做搜尋時的複製。
// 對應位置：
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8
export type Board = Cell[]

// ---------- 規則開關 ----------
// 完整規則集，每條做成布林開關。
// 搜尋引擎會根據啟用哪些規則決定翻面與出牌邏輯。
export interface Rules {
  same: boolean // 同數：兩邊以上數字相同則奪取
  plus: boolean // 加算：相鄰兩邊和相等則奪取
  combo: boolean // 連鎖：Same/Plus 翻面可引發連鎖
  reverse: boolean // 逆轉：數字小的反而奪取大的
  fallenAce: boolean // 王牌殺手：A(10) 會被 1 剋制
  order: boolean // 秩序：必須照固定順序出牌
  chaos: boolean // 混亂：每手隨機決定能出哪張卡
  threeOpen: boolean // 三明牌：對手開局公開 3 張
  allOpen: boolean // 全明牌：對手開局公開全部 5 張
  ascension: boolean // 同類強化：場上每張同陣營卡 +1（上限 10）
  descension: boolean // 同類弱化：場上每張同陣營卡 −1（下限 1）
  swap: boolean // 交換：開局前我方一張與對手一張互換（手動指定）
  // 之後要擴充其他規則（Roulette…）可繼續往下加。
}

// ---------- 一名玩家的手牌 ----------
// 場上各帶 5 張卡。出掉的卡會從這個陣列移除。
export type Hand = Card[]

// ---------- 完整賽局狀態 ----------
// 搜尋引擎的核心：一個 GameState 完整描述「當下這一刻」的局面。
// minimax 每往下探索一步，就是產生一個新的 GameState。
export interface GameState {
  board: Board // 棋盤現況
  redHand: Hand // 紅方剩餘手牌
  blueHand: Hand // 藍方剩餘手牌
  turn: Player // 輪到誰出牌
  rules: Rules // 本局啟用的規則
}

// ---------- 一步「著手」 ----------
// 描述一個出牌動作：把手牌中某張卡放到棋盤某格。
// 搜尋的結果最終就是要回傳「最佳的一個 Move」。
export interface Move {
  cardId: number // 要出的卡（用 id 對應手牌中的卡）
  cellIndex: number // 放到哪一格（0~8）
}
