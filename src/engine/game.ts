// ============================================================
// game.ts — 遊戲核心流程
// 負責把「翻面結算」串成完整的一手棋，並提供搜尋所需的基本操作：
//   - cloneState：深複製局面（不可變的基礎）
//   - getLegalMoves：列出當前玩家所有合法出牌
//   - applyMove：套用一手棋，回傳全新局面
//   - isGameOver / getWinner：勝負判定
// ============================================================

import { resolvePlacement } from './flip'
import type { Board, Card, GameState, Move, Player } from './types'

// ---------- 深複製局面 ----------
// 搜尋的基礎：applyMove 一定在複製品上操作，絕不改到原局面。
// 棋盤每一格、雙方手牌都要複製一份新的；
// 卡牌本身（Card）是唯讀資料，可以共用參照不必複製。
export function cloneState(state: GameState): GameState {
  const board: Board = state.board.map((cell) => ({
    card: cell.card, // Card 唯讀，共用參照即可
    owner: cell.owner,
  }))

  return {
    board,
    redHand: [...state.redHand], // 複製手牌陣列
    blueHand: [...state.blueHand],
    turn: state.turn,
    rules: state.rules, // 規則整局不變，共用參照
  }
}

// ---------- 取得當前玩家的手牌 ----------
function currentHand(state: GameState): Card[] {
  return state.turn === 'RED' ? state.redHand : state.blueHand
}

// ---------- 列出所有合法出牌 ----------
// 合法手 = 當前玩家可出的卡 × 棋盤上的空格。
// Order（秩序）規則啟用時，只能出手牌中的第一張。
export function getLegalMoves(state: GameState): Move[] {
  const hand = currentHand(state)
  if (hand.length === 0) return []

  // 找出所有空格。
  const emptyCells: number[] = []
  for (let i = 0; i < 9; i++) {
    if (state.board[i]!.card === null) emptyCells.push(i)
  }

  // Order 規則：只能出第一張卡；否則整手牌都可選。
  const playableCards = state.rules.order ? [hand[0]!] : hand

  const moves: Move[] = []
  for (const card of playableCards) {
    for (const cellIndex of emptyCells) {
      moves.push({ cardId: card.id, cellIndex })
    }
  }
  return moves
}

// ---------- 套用一手棋 ----------
// 流程：複製局面 → 從手牌取出該卡 → 放到棋盤 → 結算翻面 → 換手。
// 回傳全新局面，不影響傳入的 state。
export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneState(state)
  const player: Player = next.turn

  // 從當前玩家手牌中找出並移除要出的卡。
  const hand = player === 'RED' ? next.redHand : next.blueHand
  const cardIdx = hand.findIndex((c) => c.id === move.cardId)
  if (cardIdx === -1) {
    throw new Error(`手牌中找不到卡 id=${move.cardId}`)
  }
  const card = hand[cardIdx]!

  // 目標格必須是空的。
  const targetCell = next.board[move.cellIndex]!
  if (targetCell.card !== null) {
    throw new Error(`格子 ${move.cellIndex} 已經有卡`)
  }

  // 從手牌移除、放上棋盤（先設好 owner，翻面才有正確歸屬基準）。
  hand.splice(cardIdx, 1)
  targetCell.card = card
  targetCell.owner = player

  // 結算翻面：總入口統籌 Same/Plus → 基本翻面 → Combo 連鎖。
  resolvePlacement(next.board, move.cellIndex, player, next.rules)

  // 換手。
  next.turn = player === 'RED' ? 'BLUE' : 'RED'
  return next
}

// ---------- 勝負判定 ----------

// 九格全滿即遊戲結束。
export function isGameOver(state: GameState): boolean {
  return state.board.every((cell) => cell.card !== null)
}

// 計算某一方在棋盤上擁有的卡數。
function countOnBoard(state: GameState, player: Player): number {
  return state.board.filter((cell) => cell.owner === player).length
}

// 回傳勝方；平手回傳 null。
// FF14 計分：棋盤上的卡 + 自己手上剩的那張牌一起算。
// （先手方會剩 1 張在手，後手方出滿 5 張，這張手牌也計入該方分數。）
export function getWinner(state: GameState): Player | null {
  const redScore = countOnBoard(state, 'RED') + state.redHand.length
  const blueScore = countOnBoard(state, 'BLUE') + state.blueHand.length

  if (redScore > blueScore) return 'RED'
  if (blueScore > redScore) return 'BLUE'
  return null // 平手
}
