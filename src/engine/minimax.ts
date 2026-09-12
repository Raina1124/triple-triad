// ============================================================
// minimax.ts — 完全資訊下的最佳手搜尋（alpha-beta 剪枝）
//
// 前提：雙方手牌全公開、出牌順序確定。在這個前提下，
// 本檔的搜尋「保證最優」——找出的就是雙方都最佳應對下的結果。
//
// 視角約定：所有分數一律是「紅分 − 藍分」。
//   紅方（RED）= Max 方，想最大化這個值。
//   藍方（BLUE）= Min 方，想最小化這個值。
// ============================================================

import { applyMove, getLegalMoves, isGameOver } from './game'
import type { GameState, Move, Player } from './types'

// ---------- 終局評估 ----------
// 回傳「紅分 − 藍分」。正值對紅有利、負值對藍有利。
// 計分含手牌（與 getWinner 的計分一致）。
function evaluateTerminal(state: GameState): number {
  let red = state.redHand.length
  let blue = state.blueHand.length
  for (const cell of state.board) {
    if (cell.owner === 'RED') red++
    else if (cell.owner === 'BLUE') blue++
  }
  return red - blue
}

// ---------- 走法去重（改法 A）----------
// 兩張「內容相同」的牌（四邊值＋陣營相同）在賽局上完全可互換：
// 出哪一張、剩哪一張，後續所有翻面與計分結果都一樣（id 不影響勝負）。
// 因此同一格若有多張內容相同的牌可出，只需展開其中一張。
// 對手有多張未知牌時（估計卡內容全同），分支數可省 (k-1)/k。
//
// 牌的內容簽名：四邊值 + 陣營（強化/弱化只看這兩者；名稱/星級不影響對局）。
function cardSignature(
  edges: { top: number; right: number; bottom: number; left: number },
  type: string | undefined,
): string {
  return `${edges.top},${edges.right},${edges.bottom},${edges.left},${type ?? 'none'}`
}

// 過濾走法：同（格子, 牌內容）只留第一個。手牌全不同時原樣返回。
//
// 已否決的加速方向（避免重蹈覆轍）：
//   - 空盤對稱化（只展開角/邊/中代表格）：卡牌四邊有方向性，鏡射棋盤時
//     卡的邊值不會跟著鏡射，同一張卡放不同角並不等價（已實測反例）。
//   - 走法排序（1-ply 物質差）：開局翻面少、無鑑別度，實測反而變慢。
//   - 置換表：翻面讓擁有者圖樣高度依賴出牌順序，真正的置換很少，
//     鍵建構成本吃掉收益（實測增益 <25% 且部分情境倒退）。
function dedupMoves(state: GameState, moves: Move[]): Move[] {
  const hand = state.turn === 'RED' ? state.redHand : state.blueHand
  if (hand.length <= 1) return moves

  // 先確認手牌是否真的有重複內容，沒有就不必建集合（常見情況零成本）。
  const sigById = new Map<number, string>()
  const sigSet = new Set<string>()
  let hasDup = false
  for (const c of hand) {
    const s = cardSignature(c.edges, c.type)
    sigById.set(c.id, s)
    if (sigSet.has(s)) hasDup = true
    sigSet.add(s)
  }
  if (!hasDup) return moves

  const seen = new Set<string>()
  const out: Move[] = []
  for (const m of moves) {
    const key = `${sigById.get(m.cardId)}@${m.cellIndex}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out
}

// ---------- 搜尋結果 ----------
export interface SearchResult {
  score: number // 雙方最佳應對下的最終分數差（紅視角）
  move: Move | null // 當前玩家此刻的最佳一手；終局為 null
}

// ---------- alpha-beta 主搜尋 ----------
// alpha = Max 方目前已確保的最低下界
// beta  = Min 方目前已確保的最高上界
// 當 alpha >= beta 時，後續分支不可能被選，剪枝。
//
// 回傳該局面在雙方最佳應對下的分數，以及當前玩家的最佳一手。
function search(state: GameState, alpha: number, beta: number): SearchResult {
  // 終局：直接回傳分數，沒有後續著手。
  if (isGameOver(state)) {
    return { score: evaluateTerminal(state), move: null }
  }

  // 走法去重：內容相同的牌只展開一次（不影響最優值，見 dedupMoves）。
  const moves = dedupMoves(state, getLegalMoves(state))

  // 理論上未終局必有合法手；保險處理。
  if (moves.length === 0) {
    return { score: evaluateTerminal(state), move: null }
  }

  const isMax: boolean = state.turn === 'RED'
  let bestMove: Move = moves[0]!
  let bestScore = isMax ? -Infinity : Infinity

  for (const move of moves) {
    const child = applyMove(state, move)
    const result = search(child, alpha, beta)

    if (isMax) {
      // 紅方：挑最大。
      if (result.score > bestScore) {
        bestScore = result.score
        bestMove = move
      }
      if (bestScore > alpha) alpha = bestScore
    } else {
      // 藍方：挑最小。
      if (result.score < bestScore) {
        bestScore = result.score
        bestMove = move
      }
      if (bestScore < beta) beta = bestScore
    }

    // 剪枝：Max 已確保的下界 >= Min 已確保的上界，
    // 剩下的分支不可能改變雙方的選擇。
    if (alpha >= beta) break
  }

  return { score: bestScore, move: bestMove }
}

// ---------- 對外入口：找出當前玩家的最佳一手 ----------
// 回傳最佳著手與該手所導向的最終分數（紅視角）。
export function findBestMove(state: GameState): SearchResult {
  return search(state, -Infinity, Infinity)
}

// ---------- 對外：精確評估一個局面（紅視角分數）----------
// 供蒙地卡羅抽樣使用：對「已確定化」的局面做完整 alpha-beta，
// 只取分數。與 findBestMove 同一套搜尋，保證一致。
export function evaluateState(state: GameState): number {
  return search(state, -Infinity, Infinity).score
}

// ---------- 混亂規則用：限制「這一手只能出指定的牌」----------
// 根節點只展開 cardId 那張牌的落點，往下則照常搜尋
// （未來回合的隨機指定無法預知，深層維持自由選牌的近似）。
export function findBestMoveForCard(state: GameState, cardId: number): SearchResult {
  if (isGameOver(state)) {
    return { score: evaluateTerminal(state), move: null }
  }

  const moves = getLegalMoves(state).filter((m) => m.cardId === cardId)
  if (moves.length === 0) {
    return { score: evaluateTerminal(state), move: null }
  }

  const isMax: boolean = state.turn === 'RED'
  let alpha = -Infinity
  let beta = Infinity
  let bestMove: Move = moves[0]!
  let bestScore = isMax ? -Infinity : Infinity

  for (const move of moves) {
    const child = applyMove(state, move)
    const result = search(child, alpha, beta)

    if (isMax) {
      if (result.score > bestScore) {
        bestScore = result.score
        bestMove = move
      }
      if (bestScore > alpha) alpha = bestScore
    } else {
      if (result.score < bestScore) {
        bestScore = result.score
        bestMove = move
      }
      if (bestScore < beta) beta = bestScore
    }
  }

  return { score: bestScore, move: bestMove }
}

// ---------- 輔助：把分數翻譯成「對當前玩家」的好壞 ----------
// 分數是紅視角；若想知道「對 state.turn 這方」是贏是輸，用這個。
// 正 = 對該方有利、負 = 不利、0 = 平。
export function scoreForPlayer(score: number, player: Player): number {
  return player === 'RED' ? score : -score
}
