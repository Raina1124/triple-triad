// ============================================================
// flip.ts — 放下一張卡後的翻面結算（完整版）
//
// 結算順序（resolvePlacement 為總入口）：
//   1. Same / Plus 判定（只針對「剛放下的這張卡」掃描鄰邊）
//   2. 基本翻面（逐邊比大小，含 Reverse / Fallen Ace）
//   3. Combo 連鎖（只從「被 Same/Plus 翻掉的卡」展開，用基本比大小）
//
// 重要機制（已對照官方規則查證）：
//   - Same/Plus 只看新落子這一張，不檢查盤面既有卡之間的關係。
//   - Same/Plus 要「兩邊以上相符」，且相符的卡中至少一張屬於對手才觸發；
//     最終只翻屬於對手的卡。
//   - Combo 連鎖是「自動機制」而非可選規則：只要對局含 Same 或 Plus，
//     被其奪取的卡就會自動引發連鎖。連鎖本身用基本比大小，
//     且被連鎖奪取的卡可再次引發連鎖。連鎖只由 Same/Plus 奪取的卡引發，
//     不由基本翻面奪取的卡引發。
//   - Fallen Ace 只影響「基本比大小」，不影響 Same/Plus 的相等/加總判定。
// ============================================================

import type { Board, Card, Cell, Edges, EdgeValue, Player, Rules } from './types'

// ---------- 棋盤相鄰關係 ----------
// 棋盤位置（一維 index 0~8）：
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8
type Direction = 'top' | 'right' | 'bottom' | 'left'

interface Neighbor {
  dir: Direction // 從中心格看出去的方向
  index: number // 鄰格的 index
  opposite: Direction // 鄰格朝向中心格的那一邊
}

// 預先算好每一格的鄰居，避免搜尋時重複計算。
const NEIGHBORS: Neighbor[][] = buildNeighbors()

function buildNeighbors(): Neighbor[][] {
  const result: Neighbor[][] = []
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const list: Neighbor[] = []

    if (row > 0) list.push({ dir: 'top', index: i - 3, opposite: 'bottom' })
    if (col < 2) list.push({ dir: 'right', index: i + 1, opposite: 'left' })
    if (row < 2) list.push({ dir: 'bottom', index: i + 3, opposite: 'top' })
    if (col > 0) list.push({ dir: 'left', index: i - 1, opposite: 'right' })

    result.push(list)
  }
  return result
}

// ---------- 核心：兩個邊值的對決（基本比大小） ----------
// 回傳 true 表示「攻擊方獲勝，可翻面」。攻擊方＝剛放下的那張卡。
//   - 一般：attacker > defender 則勝。
//   - Reverse：反向，attacker < defender 則勝。
//   - Fallen Ace：1 可以翻 A(10)。
//
// Fallen Ace 是「多開一個例外」，不是「把 1↔10 的大小反轉」。
// 1 能翻 A 不代表 1 比 A 大：A 當攻擊方時照樣用 10 > 1 翻掉 1。
// 所以 1 與 A 互為剋星，這組對撞永遠是攻擊方（後出的那張）獲勝。
// 之前寫成 `攻擊方10 vs 防守方1 → return reverse`，等於讓 A 翻不動 1，是錯的。
//
// Reverse 同時啟用時結論相同：Reverse 本身就讓 1 < 10 的 1 能翻 A，
// 而規則文字反轉成「1 會被 A 奪取」讓 A 也能翻 1，兩個方向還是都成立。
//
// 注意 Fallen Ace 只作用於「基本比大小」，不影響 Same/Plus 的相等/加總判定
// （resolveSamePlus 不呼叫本函式）。
export function attackerWins(attacker: EdgeValue, defender: EdgeValue, rules: Rules): boolean {
  const reverse = rules.reverse

  if (rules.fallenAce) {
    const oneVsAce = (attacker === 1 && defender === 10) || (attacker === 10 && defender === 1)
    if (oneVsAce) return true
  }

  return reverse ? attacker < defender : attacker > defender
}

// ---------- 同類強化／弱化：有效數值 ----------
// 數出棋盤上某陣營的卡數（type 為 'none'/undefined 不計）。
// excludeIdx：排除某格（翻面判定時排除「正在落子」的那張，因它尚未結算）。
function countFaction(board: Board, faction: string, excludeIdx?: number): number {
  let n = 0
  for (let i = 0; i < board.length; i++) {
    if (i === excludeIdx) continue
    const t = board[i]!.card?.type
    if (t && t !== 'none' && t === faction) n++
  }
  return n
}

// 取得卡牌某一邊的「有效數值」，含強化/弱化加成。
//   - 強化（ascension）：場上每張同陣營 +1，上限夾 10。
//   - 弱化（descension）：場上每張同陣營 −1，下限夾 1。
//   - 兩者互斥；無陣營卡或未啟用時回原值。
// 數的是當前棋盤的同陣營數。翻面判定時，加成層數＝「落子前」場上已結算的
// 同陣營數，所以要排除正在落子的這張（excludeIdx）——它的加成是結算後才生效。
function edgeValue(
  cell: Cell,
  dir: Direction,
  board: Board,
  rules: Rules,
  excludeIdx?: number,
): EdgeValue {
  const card = cell.card!
  const base = card.edges[dir]

  const faction = card.type
  if (!faction || faction === 'none') return base
  if (!rules.ascension && !rules.descension) return base

  const count = countFaction(board, faction, excludeIdx)
  let v: number = base
  if (rules.ascension) v = base + count
  else if (rules.descension) v = base - count

  if (v > 10) v = 10
  if (v < 1) v = 1
  return v as EdgeValue
}

// ---------- 對外：算一張卡的有效四邊值（含強化/弱化）----------
// 供顯示層使用，讓手牌/棋盤能即時顯示加成後的數值。
// board：當前棋盤（用來數同陣營）；card：要算的卡（可能在手牌或棋盤）。
// 跟翻面判定用同一套 countFaction 邏輯，確保顯示與實際一致。
export function effectiveEdges(card: Card, board: Board, rules: Rules): Edges {
  const faction = card.type
  if (!faction || faction === 'none') return card.edges
  if (!rules.ascension && !rules.descension) return card.edges

  const count = countFaction(board, faction)
  const adj = (base: EdgeValue): EdgeValue => {
    let v: number = base
    if (rules.ascension) v = base + count
    else if (rules.descension) v = base - count
    if (v > 10) v = 10
    if (v < 1) v = 1
    return v as EdgeValue
  }
  return {
    top: adj(card.edges.top),
    right: adj(card.edges.right),
    bottom: adj(card.edges.bottom),
    left: adj(card.edges.left),
  }
}

// ---------- 基本翻面結算 ----------
// 對 placedIdx 這張卡，逐邊用基本比大小翻掉較弱的敵卡。
// 回傳被翻面的格子 index 陣列。會就地修改 board。
export function resolveFlips(
  board: Board,
  placedIdx: number,
  placedBy: Player,
  rules: Rules,
): number[] {
  const flipped: number[] = []
  const placedCell = board[placedIdx]!

  for (const neighbor of NEIGHBORS[placedIdx]!) {
    const target = board[neighbor.index]!

    if (target.card === null) continue
    if (target.owner === placedBy) continue

    // 翻面判定瞬間，雙方有效值都用「落子前」場上同陣營數
    // （排除 placedIdx 這張正在落子的卡，它的加成尚未結算生效）。
    const attacker = edgeValue(placedCell, neighbor.dir, board, rules, placedIdx)
    const defender = edgeValue(target, neighbor.opposite, board, rules, placedIdx)

    if (attackerWins(attacker, defender, rules)) {
      target.owner = placedBy
      flipped.push(neighbor.index)
    }
  }

  return flipped
}

// ---------- Same / Plus 判定 ----------
// 只針對「剛放下的這張卡」掃描其有卡的鄰邊。
// 回傳被 Same 或 Plus 奪取的「敵方」格子 index 陣列（去重）。
// 會就地把這些格子翻成 placedBy。
//
// 機制：
//   Same — 收集每個鄰邊「我方邊值 == 鄰卡相對邊值」成立的鄰格；
//          若這類鄰格有兩個以上，且其中至少一個是敵方，
//          則翻掉其中所有敵方格。
//   Plus — 收集每個鄰邊的「我方邊值 + 鄰卡相對邊值」總和；
//          若某個總和出現在兩個以上鄰格，且其中至少一個是敵方，
//          則翻掉該總和群組中所有敵方格。
function resolveSamePlus(
  board: Board,
  placedIdx: number,
  placedBy: Player,
  rules: Rules,
): number[] {
  const placedCell = board[placedIdx]!

  // 先收集所有「有卡」的鄰邊資訊。
  interface EdgeInfo {
    index: number // 鄰格 index
    isEnemy: boolean // 是否敵方
    mine: number // 我方朝向該鄰格的邊值
    theirs: number // 鄰格朝向我方的邊值
  }
  const infos: EdgeInfo[] = []
  for (const neighbor of NEIGHBORS[placedIdx]!) {
    const target = board[neighbor.index]!
    if (target.card === null) continue
    infos.push({
      index: neighbor.index,
      isEnemy: target.owner !== placedBy,
      mine: edgeValue(placedCell, neighbor.dir, board, rules, placedIdx),
      theirs: edgeValue(target, neighbor.opposite, board, rules, placedIdx),
    })
  }

  const captured = new Set<number>()

  // --- Same：找出 mine == theirs 的鄰格 ---
  if (rules.same) {
    const matched = infos.filter((e) => e.mine === e.theirs)
    const hasEnemy = matched.some((e) => e.isEnemy)
    if (matched.length >= 2 && hasEnemy) {
      for (const e of matched) {
        if (e.isEnemy) captured.add(e.index)
      }
    }
  }

  // --- Plus：依「mine + theirs」總和分群 ---
  if (rules.plus) {
    const groups = new Map<number, EdgeInfo[]>()
    for (const e of infos) {
      const sum = e.mine + e.theirs
      const g = groups.get(sum)
      if (g) g.push(e)
      else groups.set(sum, [e])
    }
    for (const group of groups.values()) {
      const hasEnemy = group.some((e) => e.isEnemy)
      if (group.length >= 2 && hasEnemy) {
        for (const e of group) {
          if (e.isEnemy) captured.add(e.index)
        }
      }
    }
  }

  // 實際翻面。
  for (const idx of captured) {
    board[idx]!.owner = placedBy
  }
  return [...captured]
}

// ---------- Combo 連鎖 ----------
// 從「被 Same/Plus 奪取的卡」逐一展開，用基本比大小翻鄰居；
// 新翻的卡再入列，反覆直到沒有新翻面。
function resolveCombo(board: Board, seeds: number[], placedBy: Player, rules: Rules): void {
  const queue: number[] = [...seeds]
  while (queue.length > 0) {
    const fromIdx = queue.shift()!
    // 以這張（已歸我方的）卡為攻擊源，做一次基本翻面。
    const newlyFlipped = resolveFlips(board, fromIdx, placedBy, rules)
    // 新翻掉的卡可再次引發連鎖。
    for (const idx of newlyFlipped) queue.push(idx)
  }
}

// ---------- 總入口：結算一次落子的所有翻面 ----------
// 呼叫前，board[placedIdx] 必須已放好卡且 owner 設為 placedBy。
//
// 順序：
//   1. Same/Plus（只看新落子）→ 取得被奪取的卡（Combo 種子）
//   2. 基本翻面（新落子逐邊比大小）
//   3. Combo 連鎖（僅從 Same/Plus 種子展開）
//
// 回傳：本次落子總共翻面的格子 index 陣列（含各機制，去重）。
export function resolvePlacement(
  board: Board,
  placedIdx: number,
  placedBy: Player,
  rules: Rules,
): number[] {
  const allFlipped = new Set<number>()

  // 1. Same/Plus（僅在規則啟用時才會真正判定）。
  let comboSeeds: number[] = []
  if (rules.same || rules.plus) {
    comboSeeds = resolveSamePlus(board, placedIdx, placedBy, rules)
    for (const idx of comboSeeds) allFlipped.add(idx)
  }

  // 2. 基本翻面（一律執行；與 Same/Plus 疊加）。
  const basicFlipped = resolveFlips(board, placedIdx, placedBy, rules)
  for (const idx of basicFlipped) allFlipped.add(idx)

  // 3. Combo 連鎖（自動機制）。
  //    Combo 不是可選規則：只要對局有 Same 或 Plus，被其奪取的卡
  //    就會自動引發連鎖。因此這裡只看「是否有 Same/Plus 種子」，
  //    不再依賴任何獨立開關。
  //    注意：種子只取自 Same/Plus，不含基本翻面結果。
  if (comboSeeds.length > 0) {
    // 記錄連鎖前的擁有狀態，連鎖後比對找出新增翻面，併入回傳集合。
    const beforeOwners = board.map((c) => c.owner)
    resolveCombo(board, comboSeeds, placedBy, rules)
    for (let i = 0; i < 9; i++) {
      if (board[i]!.owner !== beforeOwners[i] && board[i]!.owner === placedBy) {
        allFlipped.add(i)
      }
    }
  }

  return [...allFlipped]
}
