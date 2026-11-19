// ============================================================
// history.ts — 「上一步」：收回最後一手落子
//
// 做法是「把那一手倒著做回去」，不是整個局面存快照再蓋回去：
//   落子前記下 (1) 誰下的 (2) 下的是哪張卡 (3) 當時棋盤上每張卡歸誰。
//   收回時把那張卡從棋盤拿回手牌，其餘卡的歸屬照記錄還原。
//
// 為什麼不用快照：落子之後使用者可能又改過東西——修正棋盤上某張卡的數值、
// 編輯手牌、用「調換位置」搬動棋盤或手牌。蓋回快照會把這些修正一起吃掉，
// 而且編輯手牌時已同步進牌組記憶，手牌退回舊值就會跟牌組對不上。
// 倒著做只動「那張卡在哪、每張卡歸誰」，卡片內容一律用現在的。
//
// 全程用卡 id 認卡，不用格子位置：棋盤上的卡 id 在一局內不重複，
// 即使之後被「調換位置」搬到別格也找得到。
// ============================================================

import type { Board, Card, Player } from './engine/types'

export interface PlacementRecord {
  player: Player // 這一手是誰下的
  cardId: number // 下的那張卡
  owners: [cardId: number, owner: Player][] // 落子前棋盤上每張卡的歸屬
}

// 落子「之前」呼叫：記下收回這一手所需的資訊。
export function recordPlacement(board: Board, player: Player, cardId: number): PlacementRecord {
  const owners: [number, Player][] = []
  for (const cell of board) {
    if (cell.card && cell.owner) owners.push([cell.card.id, cell.owner])
  }
  return { player, cardId, owners }
}

export interface UndoResult {
  board: Board
  redHand: Card[]
  blueHand: Card[]
}

// 收回一手。redOrig / blueOrig 是開局發的 5 張（畫面上的固定槽位順序）：
// 卡要插回它原本的槽位，秩序規則才會仍然從正確的那張開始出。
// 找不到那張卡（不該發生）時回 null，呼叫端不動局面。
export function undoPlacement(
  record: PlacementRecord,
  board: Board,
  redHand: Card[],
  blueHand: Card[],
  redOrig: Card[],
  blueOrig: Card[],
): UndoResult | null {
  const placedIdx = board.findIndex((cell) => cell.card?.id === record.cardId)
  if (placedIdx === -1) return null
  const card = board[placedIdx]!.card!

  const ownerBefore = new Map(record.owners)
  const nextBoard: Board = board.map((cell, i) => {
    if (i === placedIdx || cell.card === null) return { card: null, owner: null }
    return { card: cell.card, owner: ownerBefore.get(cell.card.id) ?? cell.owner }
  })

  // 手牌的不變式：順序 = 開局槽位順序濾掉已出的。照這個順序重排，把卡補回去。
  const orig = record.player === 'RED' ? redOrig : blueOrig
  const live = record.player === 'RED' ? redHand : blueHand
  const hand = orig
    .map((o) => (o.id === card.id ? card : live.find((c) => c.id === o.id)))
    .filter((c): c is Card => c !== undefined)

  return {
    board: nextBoard,
    redHand: record.player === 'RED' ? hand : redHand,
    blueHand: record.player === 'BLUE' ? hand : blueHand,
  }
}
