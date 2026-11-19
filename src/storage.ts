// ============================================================
// storage.ts — 牌組與設定的永久儲存（localStorage）
//
// 存的是「重置牌局後仍會留著」的那些東西：我方牌組、對手牌組記憶、
// 兩組牌組槽、我方座位、開局先手、規則、對手牌組模型。
// 進行中的棋盤與手牌不存——重新整理網頁等同按一次「重置牌局」。
//
// 這個檔案只做「資料 ⇄ 字串」的轉換與檢查，不碰 localStorage 本身
// （讀寫在 App.vue），所以可以直接用單元測試驗證。
//
// 讀回來的資料一律先檢查形狀：改版後欄位可能對不上，壞資料一旦進了
// 狀態會讓整頁開不起來，而使用者只能自己去清瀏覽器資料才救得回來。
// 檢查不過就整份丟掉、回到預設值，不嘗試修補。
// ============================================================

import { CARD_POOL } from './engine/card-pool'
import { NPC_DECKS } from './engine/npc-decks'
import type { Card, Player, Rules } from './engine/types'

export const STORAGE_KEY = 'tt-state'
// 存檔格式版本。欄位的意義有變（不只是新增規則）時加一，舊存檔會被丟掉。
const VERSION = 1

export interface MyDeckSlot {
  name: string
  deck: Card[] | null
}
export interface OppDeckSlot {
  name: string
  deck: (Card | null)[] | null // 對手牌組可能只填了部分
}
export type OppKind = 'npc' | 'player' | 'draft'

export interface SavedState {
  myDeck: Card[]
  oppDeck: (Card | null)[]
  myDeckSlots: MyDeckSlot[]
  oppDeckSlots: OppDeckSlot[]
  mySide: Player
  firstPlayer: Player
  rules: Rules
  oppKind: OppKind
  oppNpcId: number | null
  lastNpcId: number | null
}

export function serializeState(state: SavedState): string {
  return JSON.stringify({ v: VERSION, ...state })
}

// ---------- 形狀檢查 ----------
type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null
const isInt = (x: unknown, min: number, max: number): boolean =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max
const isPlayer = (x: unknown): x is Player => x === 'RED' || x === 'BLUE'
const isIdOrNull = (x: unknown): x is number | null => x === null || Number.isInteger(x)

function isCard(x: unknown): x is Card {
  if (!isObj(x) || !isObj(x.edges)) return false
  const e = x.edges
  return (
    Number.isInteger(x.id) &&
    typeof x.name === 'string' &&
    isInt(x.stars, 1, 5) &&
    isInt(e.top, 1, 10) &&
    isInt(e.right, 1, 10) &&
    isInt(e.bottom, 1, 10) &&
    isInt(e.left, 1, 10)
  )
}
const isCardOrNull = (x: unknown): x is Card | null => x === null || isCard(x)

function isArrayOf<T>(x: unknown, length: number, item: (v: unknown) => v is T): x is T[] {
  return Array.isArray(x) && x.length === length && x.every(item)
}
const isMyDeck = (x: unknown): x is Card[] => isArrayOf(x, 5, isCard)
const isOppDeck = (x: unknown): x is (Card | null)[] => isArrayOf(x, 5, isCardOrNull)
const isMySlot = (x: unknown): x is MyDeckSlot =>
  isObj(x) && typeof x.name === 'string' && (x.deck === null || isMyDeck(x.deck))
const isOppSlot = (x: unknown): x is OppDeckSlot =>
  isObj(x) && typeof x.name === 'string' && (x.deck === null || isOppDeck(x.deck))

// ---------- 中文卡名更新 ----------
// 存檔裡的卡是當時的整張複本，之後 cards-zh.ts 補了中文名，舊存檔不會自己跟上。
// 讀檔時用英文名（卡池內不重複）回卡池查一次最新的中文名。
// 不能用 id 查：手牌與牌組裡的卡保留的是「槽位 id」，不是卡池 id。
// 手動輸入數值的卡（名稱「已填入」）查不到，維持原樣。
const ZH_BY_NAME = new Map(CARD_POOL.map((c) => [c.name, c.nameZh]))
function refreshName(c: Card): Card {
  const zh = ZH_BY_NAME.get(c.name)
  return zh ? { ...c, nameZh: zh } : c
}
const refreshOrNull = (c: Card | null): Card | null => (c ? refreshName(c) : null)

// ---------- 讀檔 ----------
// raw：localStorage 取出的字串（沒存過是 null）。
// defaultRules：目前版本的規則預設值。存檔的規則逐欄蓋上去，所以之後新增
// 規則欄位時，舊存檔會自動補上預設值，不必為此升版本。
// 回傳 null 代表沒有可用的存檔，呼叫端用預設值。
export function parseSaved(raw: string | null, defaultRules: Rules): SavedState | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(data) || data.v !== VERSION) return null
  if (
    !isMyDeck(data.myDeck) ||
    !isOppDeck(data.oppDeck) ||
    !isArrayOf(data.myDeckSlots, 3, isMySlot) ||
    !isArrayOf(data.oppDeckSlots, 3, isOppSlot) ||
    !isPlayer(data.mySide) ||
    !isPlayer(data.firstPlayer) ||
    !isObj(data.rules) ||
    !(data.oppKind === 'npc' || data.oppKind === 'player' || data.oppKind === 'draft') ||
    !isIdOrNull(data.oppNpcId) ||
    !isIdOrNull(data.lastNpcId)
  ) {
    return null
  }

  const rules: Rules = { ...defaultRules }
  for (const key of Object.keys(defaultRules) as (keyof Rules)[]) {
    const v = data.rules[key]
    if (typeof v === 'boolean') rules[key] = v
  }

  // NPC 資料改版後該 NPC 可能已不存在：當作還沒選（畫面會顯示「尚未選 NPC」）。
  const npcId = data.oppNpcId
  const npcExists = npcId !== null && NPC_DECKS.some((n) => n.id === npcId)

  return {
    myDeck: data.myDeck.map(refreshName),
    oppDeck: data.oppDeck.map(refreshOrNull),
    myDeckSlots: data.myDeckSlots.map((s) => ({
      name: s.name,
      deck: s.deck ? s.deck.map(refreshName) : null,
    })),
    oppDeckSlots: data.oppDeckSlots.map((s) => ({
      name: s.name,
      deck: s.deck ? s.deck.map(refreshOrNull) : null,
    })),
    mySide: data.mySide,
    firstPlayer: data.firstPlayer,
    rules,
    oppKind: data.oppKind,
    oppNpcId: npcExists ? npcId : null,
    lastNpcId: data.lastNpcId,
  }
}

// ---------- 未知卡 id 的起點 ----------
// 未知卡用遞減的負數 id（-1、-2…）。對手牌組記憶與對手牌組槽裡的卡，
// 留著的是當初發牌時的負數 id；重新整理後計數器若又從 -1 開始，新發的
// 未知卡會跟記住的卡撞號——同一手牌出現兩張相同 id，選牌與落子都會錯亂。
// 所以起點要排在存檔裡所有 id 的下面。
export function firstFreeUnknownId(saved: SavedState | null): number {
  let next = -1
  if (!saved) return next
  const cards = [
    ...saved.myDeck,
    ...saved.oppDeck,
    ...saved.myDeckSlots.flatMap((s) => s.deck ?? []),
    ...saved.oppDeckSlots.flatMap((s) => s.deck ?? []),
  ]
  for (const c of cards) {
    if (c && c.id <= next) next = c.id - 1
  }
  return next
}
