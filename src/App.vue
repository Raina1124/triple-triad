<script setup lang="ts">
// ============================================================
// App.vue — 金碟幻卡 · 分析台（容器元件）
// 職責：持有所有狀態、呼叫引擎、組合展示型子元件。
// 展示細節都在子元件：CardView / HandPanel / BoardCell / RuleBar。
// ============================================================
import { ref, computed, reactive } from 'vue'
import type { Board, Cell, GameState, Player, Rules, Card, EdgeValue, Edges } from './engine/types'
import { CARD_POOL } from './engine/card-pool'
import { applyMove, getWinner, isGameOver } from './engine/game'
import { effectiveEdges } from './engine/flip'
import { findBestMoveMonteCarlo } from './engine/montecarlo'
import type { MonteCarloResult } from './engine/montecarlo'
import { NPC_DECKS } from './engine/npc-decks'
import { NPC_NAMES_ZH } from './engine/npc-zh'
import type { OpponentModelSpec } from './engine/opponent-model'
import HandPanel from './components/HandPanel.vue'
import BoardCell from './components/BoardCell.vue'
import RuleBar from './components/RuleBar.vue'
import CardPicker from './components/CardPicker.vue'

// ---------- 視窗寬度 ----------
// 手機（≤720px）時，對手牌組模型與牌組槽預設摺疊，棋盤優先。
const narrowQuery = window.matchMedia('(max-width: 720px)')
const narrow = ref(narrowQuery.matches)
narrowQuery.addEventListener('change', (e) => (narrow.value = e.matches))

// ---------- 初始狀態 ----------
function emptyBoard(): Board {
  const b: Cell[] = []
  for (let i = 0; i < 9; i++) b.push({ card: null, owner: null })
  return b
}

// ---------- 規則 ----------
// 定義在發牌之前，因為發牌要讀明牌規則（threeOpen/allOpen）。
const rules = reactive<Rules>({
  same: false,
  plus: false,
  combo: false,
  reverse: false,
  fallenAce: false,
  order: false,
  chaos: false,
  threeOpen: false,
  allOpen: false,
  ascension: false,
  descension: false,
  swap: false,
})

// ---------- 開局設定狀態 ----------
// 「我方顏色」與「先後手」是兩件獨立的事：
//   - mySide：我方是紅還是藍（影響視覺強調、發牌時哪方是對手）。
//   - firstPlayer：開局誰先下。
// 定義在發牌之前，因為 dealHand 要讀 mySide 判斷哪方發未知卡。
const mySide = ref<Player>('RED')
const firstPlayer = ref<Player>('RED')

// 產生一張未知卡（對手尚未揭曉的牌）。
// 給一個佔位數值，但標記 unknown，顯示時會畫成問號。
let unknownIdCounter = -1 // 用負數 id 避免跟真實卡撞號
function makeUnknownCard(): Card {
  return {
    id: unknownIdCounter--,
    name: '未知',
    stars: 1,
    edges: { top: 1, right: 1, bottom: 1, left: 1 },
    unknown: true,
  }
}

// 我方預設手牌（佔位，之後用搜尋換成真實牌）。
function myDefaultHand(): Card[] {
  return CARD_POOL.slice(0, 5).map((c) => ({ ...c }))
}

// 對手牌組記憶（持久，重置不清空，可被「洗掉對手牌」清空）。
// 5 格，每格：已填過的卡 or null（還沒填過）。
// 同一個 NPC 打多次時，填過的牌會被記住。
const oppDeck = ref<(Card | null)[]>([null, null, null, null, null])

// 對手手牌：有牌組記憶的格用記憶，其餘全部未知（不鎖死位置）。
// 三明牌/全明牌規則下，哪幾張公開是隨機的，所以開局全未知，
// 由你自由點任一張未知卡填入實際公開的數值（不限位置、不限時機）。
// 明牌規則只作為搜尋估計的提示（見 buildEstimateState）。
function opponentHand(): Card[] {
  const hand: Card[] = []
  for (let i = 0; i < 5; i++) {
    const remembered = oppDeck.value[i]
    if (remembered) {
      // 有記憶：用記住的卡（深複製，避免對局消耗影響牌組）。
      hand.push({ ...remembered, edges: { ...remembered.edges } })
    } else {
      hand.push(makeUnknownCard())
    }
  }
  return hand
}

// 依「我方是哪一邊」決定某一方該發我方牌還是對手牌。
function dealHand(player: Player): Card[] {
  return player === mySide.value ? myDeckCopy() : opponentHand()
}

// ---------- 我方牌組（持久，重置不清空）----------
// 我方 5 張是長期固定牌組，重打不該重輸入。
// myDeck 存當前數值；重發時複製一份給手牌（手牌會在對局中被消耗，
// 不能直接動到牌組本身）。編輯我方手牌時會同步更新回 myDeck。
const myDeck = ref<Card[]>(CARD_POOL.slice(0, 5).map((c) => ({ ...c })))

// 複製一份牌組給手牌使用（深複製卡物件，避免對局消耗影響牌組）。
function myDeckCopy(): Card[] {
  return myDeck.value.map((c) => ({ ...c, edges: { ...c.edges } }))
}

// 洗掉對手牌：清空對手牌組記憶，重發牌局（我方牌組保留）。
// 換 NPC 時用，讓對手變回未知（依明牌規則）。
function clearOppDeck() {
  oppDeck.value = [null, null, null, null, null]
  resetBoard()
}

// ---------- 對手牌組模型 ----------
// 「對手的未知牌從哪裡抽」是建議品質最大的變因（見 opponent-model.ts）：
// 預設的全卡池均勻抽等於假設對手拿一副隨機爛牌，會讓自報分數過度樂觀。
//   NPC   → 用該 NPC 的實際牌組，抽樣空間從 470 塌縮到約 5~10 張。
//   玩家  → 牌組星級上限照遊戲規則，填充位假設為有競爭力的 3★。
//   不指定 → 維持舊行為。
const oppKind = ref<'uniform' | 'npc' | 'player'>('uniform')
const oppNpcId = ref<number | null>(null)
const npcQuery = ref('')

// NPC 清單：合併 npc-zh.ts 的中文名（沒填的維持 undefined，顯示時退回英文）。
const npcList = computed(() =>
  NPC_DECKS.map((n) => ({ ...n, nameZh: NPC_NAMES_ZH[n.id] || undefined })),
)

// NPC 搜尋：中英文都比對，中文只填一部分也能用。
// 輸入才顯示，避免一次塞 134 筆。
const npcMatches = computed(() => {
  const raw = npcQuery.value.trim()
  if (raw === '') return []
  const q = raw.toLowerCase()
  return npcList.value
    .filter((n) => n.name.toLowerCase().includes(q) || (n.nameZh ?? '').includes(raw))
    .slice(0, 8)
})
const selectedNpc = computed(() => npcList.value.find((n) => n.id === oppNpcId.value) ?? null)

function pickNpc(id: number) {
  oppNpcId.value = id
  npcQuery.value = ''
}

// 傳給引擎的模型設定。選了 NPC 類型但還沒選 NPC 時退回 uniform。
const opponentSpec = computed<OpponentModelSpec>(() => {
  if (oppKind.value === 'npc' && oppNpcId.value !== null)
    return { kind: 'npc', npcId: oppNpcId.value }
  if (oppKind.value === 'player') return { kind: 'player' }
  return { kind: 'uniform' }
})

// ---------- 牌組儲存槽（僅本次網頁工作階段）----------
// 同一次開網頁打多個 NPC 時，可把目前牌組快照進槽位、之後取回，
// 不用重新輸入。存在記憶體，重新整理/關閉網頁即消失
// （localStorage 永久儲存為待辦範圍 B，屆時可直接序列化這兩個陣列）。
interface MyDeckSlot {
  name: string
  deck: Card[] | null
}
interface OppDeckSlot {
  name: string
  deck: (Card | null)[] | null // 對手牌組可能只填了部分
}

const emptyMySlot = (): MyDeckSlot => ({ name: '', deck: null })
const emptyOppSlot = (): OppDeckSlot => ({ name: '', deck: null })
const myDeckSlots = ref<MyDeckSlot[]>([emptyMySlot(), emptyMySlot(), emptyMySlot()])
const oppDeckSlots = ref<OppDeckSlot[]>([emptyOppSlot(), emptyOppSlot(), emptyOppSlot()])

const copyCard = (c: Card): Card => ({ ...c, edges: { ...c.edges } })

// 存：把目前牌組快照進槽位（深複製，之後的編輯不影響快照）。
function saveMySlot(i: number) {
  myDeckSlots.value[i]!.deck = myDeck.value.map(copyCard)
}
function saveOppSlot(i: number) {
  oppDeckSlots.value[i]!.deck = oppDeck.value.map((c) => (c ? copyCard(c) : null))
}
// 取：把槽位快照放回目前牌組並重發牌局（手牌是從牌組發出的）。
function loadMySlot(i: number) {
  const d = myDeckSlots.value[i]!.deck
  if (!d) return
  myDeck.value = d.map(copyCard)
  resetBoard()
}
function loadOppSlot(i: number) {
  const d = oppDeckSlots.value[i]!.deck
  if (!d) return
  oppDeck.value = d.map((c) => (c ? copyCard(c) : null))
  resetBoard()
}

// ---------- 交換規則（手動指定互換）----------
// 開局前我方一張與對手一張互換。流程：進入交換模式 →
// 點我方一張 → 點對手一張 → 互換兩張數值，退出模式。
const swapMode = ref(false)
const swapFirstId = ref<number | null>(null) // 已選的我方那張

function startSwap() {
  swapMode.value = true
  swapFirstId.value = null
  cancelMove() // 與調換模式互斥
}

function cancelSwap() {
  swapMode.value = false
  swapFirstId.value = null
}

// 交換模式下點了某張手牌。
function swapPick(cardId: number) {
  const oppSide: Player = mySide.value === 'RED' ? 'BLUE' : 'RED'
  const myHand = mySide.value === 'RED' ? redHand.value : blueHand.value
  const isMine = myHand.some((c) => c.id === cardId)

  if (swapFirstId.value === null) {
    // 第一段：只能先點我方的牌。
    if (isMine) swapFirstId.value = cardId
    return
  }
  // 第二段：要點對手的牌才成立。
  if (isMine) {
    // 又點了我方牌 → 改選這張當第一段。
    swapFirstId.value = cardId
    return
  }
  // 執行互換：我方 swapFirstId 那張 ↔ 對手 cardId 那張。
  doSwap(swapFirstId.value, cardId)
  cancelSwap()
}

// 互換兩張牌的「內容」（保留各自原本的 id 與位置，只換卡面資料）。
// 這樣手牌位置不變，但數值/名稱/陣營對調，等同實際交換結果。
function doSwap(myId: number, oppId: number) {
  const findCard = (id: number): Card | undefined =>
    redHand.value.find((c) => c.id === id) ?? blueHand.value.find((c) => c.id === id)
  const a = findCard(myId)
  const b = findCard(oppId)
  if (!a || !b) return

  // 取出兩張的內容（除 id 外）。
  const aContent = { ...a }
  const bContent = { ...b }

  const swapIn = (hand: Card[]) => {
    const ia = hand.findIndex((c) => c.id === myId)
    if (ia !== -1) hand[ia] = { ...bContent, id: myId, edges: { ...bContent.edges } }
    const ib = hand.findIndex((c) => c.id === oppId)
    if (ib !== -1) hand[ib] = { ...aContent, id: oppId, edges: { ...aContent.edges } }
  }
  swapIn(redHand.value)
  swapIn(blueHand.value)
  redHand.value = [...redHand.value]
  blueHand.value = [...blueHand.value]

  // 注意：交換「不」同步回牌組（myDeck/oppDeck）。
  // 牌組保持交換前的原始牌，這樣重置/關閉交換規則時重發即可還原。
}

// ---------- 調換位置（輸入更正 / 秩序規則看順序）----------
// 兩種用途：填錯槽位要對調、秩序規則下要讓畫面順序等於實際手牌順序。
// 涵蓋手牌與棋盤兩個域，但兩域不互通（手牌只能跟同一方的手牌換）。
//
// 棋盤的調換刻意「不」重跑 resolvePlacement：它是純輸入更正工具，
// 只對調兩格的卡與歸屬。搬動一張已結算過的卡去重跑翻面，會產生
// 當初根本不可能發生的盤面，那是另一種行為，不是更正。
type MoveTarget = { kind: 'hand'; player: Player; index: number } | { kind: 'board'; index: number }
const moveMode = ref(false)
const moveFirst = ref<MoveTarget | null>(null)

function startMove() {
  moveMode.value = true
  moveFirst.value = null
  cancelSwap() // 與交換規則互斥，避免兩個模式同時吃點擊
  selectedCardId.value = null
  suggestedCell.value = null
}
function cancelMove() {
  moveMode.value = false
  moveFirst.value = null
}

// 已選第一個目標的高亮：手牌用卡 id（沿用 HandPanel 既有的 swapFirstId），
// 棋盤用格子 index。
const moveFirstCardId = computed(() => {
  const m = moveFirst.value
  if (!m || m.kind !== 'hand') return null
  const orig = m.player === 'RED' ? redHandOrig.value : blueHandOrig.value
  return orig[m.index]?.id ?? null
})
const pickedCell = computed(() => {
  const m = moveFirst.value
  return m && m.kind === 'board' ? m.index : -1
})

function swapAt<T>(arr: T[], i: number, j: number): T[] {
  const a = [...arr]
  const t = a[i]!
  a[i] = a[j]!
  a[j] = t
  return a
}

// 調換模式下點了某張手牌。
function movePickHand(cardId: number) {
  const locate = (): MoveTarget | null => {
    let i = redHandOrig.value.findIndex((c) => c.id === cardId)
    if (i !== -1) return { kind: 'hand', player: 'RED', index: i }
    i = blueHandOrig.value.findIndex((c) => c.id === cardId)
    if (i !== -1) return { kind: 'hand', player: 'BLUE', index: i }
    return null
  }
  const target = locate()
  if (!target || target.kind !== 'hand') return

  const first = moveFirst.value
  // 沒選過、或先前選的是棋盤格、或選的是另一方的手牌 → 改選這張當第一個。
  if (!first || first.kind !== 'hand' || first.player !== target.player) {
    moveFirst.value = target
    return
  }
  swapHandSlots(target.player, first.index, target.index)
  moveFirst.value = null
}

// 對調同一方手牌的兩個槽位。
// 三個陣列都要動，少一個就會不一致：
//   ...HandOrig  → 畫面顯示順序
//   ...Hand      → 秩序規則實際看的順序（game.ts 的 getLegalMoves 取 hand[0]）
//   myDeck/oppDeck → 持久牌組，位置與 Orig 一一對應；不同步的話之後編輯
//                    會寫到錯的牌組槽，重置也會跳回舊順序。
function swapHandSlots(player: Player, i: number, j: number) {
  if (i === j) return
  const origRef = player === 'RED' ? redHandOrig : blueHandOrig
  const liveRef = player === 'RED' ? redHand : blueHand

  const orig = swapAt(origRef.value, i, j)
  origRef.value = orig

  // live 手牌重排成「Orig 順序濾掉已出的」，維持既有不變式：
  // 顯示順序與 hand[0] 永遠一致。
  const live = liveRef.value
  liveRef.value = orig
    .map((o) => live.find((c) => c.id === o.id))
    .filter((c): c is Card => c !== undefined)

  if (player === mySide.value) myDeck.value = swapAt(myDeck.value, i, j)
  else oppDeck.value = swapAt(oppDeck.value, i, j)

  selectedCardId.value = null
  suggestedCell.value = null
}

// 調換模式下點了某一格棋盤。第一次點必須點有卡的格（你要搬的是那張卡），
// 第二次點任意格：對方有卡就是互換，空格就是搬過去。
function movePickCell(index: number) {
  const first = moveFirst.value
  if (!first || first.kind !== 'board') {
    if (board.value[index]!.card === null) return
    moveFirst.value = { kind: 'board', index }
    return
  }
  if (first.index !== index) swapBoardCells(first.index, index)
  moveFirst.value = null
}

function swapBoardCells(i: number, j: number) {
  const b = [...board.value]
  const a = b[i]!
  const c = b[j]!
  b[i] = { card: c.card, owner: c.owner }
  b[j] = { card: a.card, owner: a.owner }
  board.value = b
  selectedCardId.value = null
  suggestedCell.value = null
}

// 編輯了手牌某張卡後，同步更新到對應牌組（我方→myDeck、對手→oppDeck），
// 這樣重置牌局後仍保留。用「手牌中的位置 index」對應牌組位置。
function syncDeckFromHand(cardId: number) {
  const oppSide: Player = mySide.value === 'RED' ? 'BLUE' : 'RED'

  // 先判斷這張卡屬於我方還是對手手牌。
  const myHand = mySide.value === 'RED' ? redHand.value : blueHand.value
  const myOrig = mySide.value === 'RED' ? redHandOrig.value : blueHandOrig.value
  const oppHand = oppSide === 'RED' ? redHand.value : blueHand.value
  const oppOrig = oppSide === 'RED' ? redHandOrig.value : blueHandOrig.value

  // 我方：同步 myDeck。
  const myPos = myOrig.findIndex((c) => c.id === cardId)
  if (myPos !== -1) {
    const live = myHand.find((c) => c.id === cardId)
    if (live) {
      const deck = [...myDeck.value]
      deck[myPos] = { ...live, edges: { ...live.edges } }
      myDeck.value = deck
    }
    return
  }

  // 對手：同步 oppDeck。
  const oppPos = oppOrig.findIndex((c) => c.id === cardId)
  if (oppPos !== -1) {
    const live = oppHand.find((c) => c.id === cardId)
    // 只記住「已知（已填數值）」的對手卡；未知卡不記。
    if (live && !live.unknown) {
      const deck = [...oppDeck.value]
      deck[oppPos] = { ...live, edges: { ...live.edges } }
      oppDeck.value = deck
    }
  }
}

const board = ref<Board>(emptyBoard())
const redHand = ref<Card[]>(dealHand('RED'))
const blueHand = ref<Card[]>(dealHand('BLUE'))
// 原始手牌（記住開局發的 5 張，供顯示固定位置與「已出」灰框）。
// 用 id 比對當前手牌即可判斷某位置出了沒，編輯不改 id 故無需同步。
const redHandOrig = ref<Card[]>([...redHand.value])
const blueHandOrig = ref<Card[]>([...blueHand.value])

// 重新發牌：我方沿用牌組、對手重發未知卡。
function redeal() {
  redHand.value = dealHand('RED')
  blueHand.value = dealHand('BLUE')
  redHandOrig.value = [...redHand.value]
  blueHandOrig.value = [...blueHand.value]
}

const turn = ref<Player>('RED')

// ---------- 開局設定 ----------
// 「我方顏色」與「先後手」是兩件獨立的事：
//   - mySide：我方是紅還是藍（影響視覺強調與「建議最佳手」幫誰算）。
//   - 先後手：由開局誰先下決定，存在 turn 的初始值裡。
// 後手 = 對手先下第一張。

// 設定開局：指定我方顏色與我方是否先手，據此決定誰先下。
function setupGame(side: Player, iGoFirst: boolean) {
  mySide.value = side
  const opponent: Player = side === 'RED' ? 'BLUE' : 'RED'
  // 我先手 → 我方顏色先下；我後手 → 對手先下。
  const first: Player = iGoFirst ? side : opponent
  turn.value = first
  firstPlayer.value = first // 記住先手方，供重置沿用
  // 重新發牌、清空棋盤。
  board.value = emptyBoard()
  redeal()
  selectedCardId.value = null
  suggestedCell.value = null
  suggestionText.value = ''
}

// 只改「我方座位」，先手方維持不變（兩者獨立），並重置牌局。
function setMySide(side: Player) {
  if (mySide.value === side) return
  mySide.value = side
  resetBoard()
}

// 只改「開局先手」，我方座位維持不變，並重置牌局。
function setFirst(first: Player) {
  if (firstPlayer.value === first) return
  firstPlayer.value = first
  resetBoard()
}

// 清空棋盤、重發牌、依目前 firstPlayer 設定先手。
function resetBoard() {
  board.value = emptyBoard()
  redeal()
  turn.value = firstPlayer.value
  selectedCardId.value = null
  suggestedCell.value = null
  suggestionText.value = ''
  // 重置時退出交換模式（被換走的卡已隨重發還原）。
  swapMode.value = false
  swapFirstId.value = null
}

function updateRules(next: Rules) {
  // 任何規則改變都重置牌局：
  //   - 明牌規則影響對手未知卡數量（需重發牌）。
  //   - 其他規則（如同類強化/弱化）影響盤面數值計算，重置最單純一致。
  //   - 交換規則的牌組未污染，重發即還原被換走的卡。
  const swapTurnedOff = rules.swap && !next.swap
  Object.assign(rules, next)
  if (swapTurnedOff) cancelSwap() // 關閉交換時退出交換模式
  resetBoard()
}

// ---------- 選取與落子 ----------
const selectedCardId = ref<number | null>(null)
const suggestedCell = ref<number | null>(null)
const suggestionText = ref<string>('')

// ---------- 卡牌數值編輯（手動輸入） ----------
// 編輯權限放寬：手牌與「棋盤上已放的卡」都可隨時點開修正數值。
// 原因：對手出牌後你才看到真實數值，需要能補填；一開始填錯也要能改。
// editingCardId 用於手牌；editingCellIndex 用於棋盤卡。
const editingCardId = ref<number | null>(null)
const editingCellIndex = ref<number | null>(null)

// 目前正在編輯的卡（手牌或棋盤卡，給編輯面板顯示）。
const editingCard = computed<Card | null>(() => {
  if (editingCellIndex.value !== null) {
    return board.value[editingCellIndex.value]?.card ?? null
  }
  if (editingCardId.value !== null) {
    return (
      redHand.value.find((c) => c.id === editingCardId.value) ??
      blueHand.value.find((c) => c.id === editingCardId.value) ??
      null
    )
  }
  return null
})

// 正在編輯的是不是「對手的手牌」？只有這個情況才收斂選卡範圍：
// 我方手牌是自己的牌組，棋盤上的卡已經翻開過、編輯屬於事後更正，
// 都不該被對手牌組限制住。
const editingOppHand = computed(() => {
  const id = editingCardId.value
  if (id === null) return false
  const oppHand = mySide.value === 'RED' ? blueHand.value : redHand.value
  return oppHand.some((c) => c.id === id)
})

// 選卡彈窗的候選卡池：填對手手牌 ＋ 對手是已選定的 NPC 時，
// 收斂成該 NPC 的牌組（fixed + variable，約 5~9 張），
// 不必在 475 張裡翻。其餘情況回傳 undefined＝用全卡池。
const pickerPool = computed<Card[] | undefined>(() => {
  if (!editingOppHand.value) return undefined
  if (oppKind.value !== 'npc') return undefined
  const npc = selectedNpc.value
  if (!npc) return undefined
  const byId = new Map(CARD_POOL.map((c) => [c.id, c]))
  const cards = [...npc.fixed, ...npc.variable]
    .map((i) => byId.get(i))
    .filter((c): c is Card => c !== undefined)
  return cards.length > 0 ? cards : undefined
})
const pickerPoolNote = computed(() => {
  const pool = pickerPool.value
  const npc = selectedNpc.value
  if (!pool || !npc) return undefined
  return `已篩選為「${npc.nameZh ?? npc.name}」的牌組（${pool.length} 張）`
})

function startEdit(cardId: number) {
  editingCellIndex.value = null
  editingCardId.value = cardId
}

function startEditCell(cellIndex: number) {
  // 只有放了卡的格子才能編輯。
  if (board.value[cellIndex]?.card == null) return
  editingCardId.value = null
  editingCellIndex.value = cellIndex
}

function cancelEdit() {
  editingCardId.value = null
  editingCellIndex.value = null
}

// 使用者主動取消編輯面板：除了關閉，也要清掉等待中的落子。
function cancelPicker() {
  pendingPlaceCell.value = null
  cancelEdit()
}

// 從卡庫選了一整張卡：用該卡的完整資料替換目前編輯的位置。
// 保留位置原本的 id（手牌的 id 要維持，才不會跟選取/落子邏輯衝突），
// 只把卡的內容（名稱、數值、星級等）換成選中的卡。
function pickCard(picked: Card) {
  // 編輯棋盤卡。
  if (editingCellIndex.value !== null) {
    const cell = board.value[editingCellIndex.value]
    if (cell && cell.card) {
      cell.card = { ...picked, id: cell.card.id }
      board.value = [...board.value]
    }
    cancelEdit()
    return
  }
  // 編輯手牌。
  const id = editingCardId.value
  if (id === null) return
  const updateIn = (hand: Card[]): boolean => {
    const idx = hand.findIndex((c) => c.id === id)
    if (idx === -1) return false
    hand[idx] = { ...picked, id } // 保留原手牌 id；picked 無 unknown 標記
    return true
  }
  if (!updateIn(redHand.value)) updateIn(blueHand.value)
  redHand.value = [...redHand.value]
  blueHand.value = [...blueHand.value]
  syncDeckFromHand(id) // 若是我方手牌，同步到持久牌組
  finishHandEdit(id)
}

// 手動輸入四邊數值：只更新 edges，其餘保留。
function applyManual(edges: {
  top: EdgeValue
  right: EdgeValue
  bottom: EdgeValue
  left: EdgeValue
}) {
  // 編輯棋盤卡。
  if (editingCellIndex.value !== null) {
    const cell = board.value[editingCellIndex.value]
    if (cell && cell.card) {
      cell.card = { ...cell.card, edges: { ...edges } }
      board.value = [...board.value]
    }
    cancelEdit()
    return
  }
  // 編輯手牌。
  const id = editingCardId.value
  if (id === null) return
  const updateIn = (hand: Card[]): boolean => {
    const idx = hand.findIndex((c) => c.id === id)
    if (idx === -1) return false
    // 填了真實數值，清掉 unknown 標記、給個可辨識的名稱。
    const base = hand[idx]!
    hand[idx] = {
      ...base,
      edges: { ...edges },
      unknown: false,
      name: base.unknown ? '已填入' : base.name,
    }
    return true
  }
  if (!updateIn(redHand.value)) updateIn(blueHand.value)
  redHand.value = [...redHand.value]
  blueHand.value = [...blueHand.value]
  syncDeckFromHand(id) // 若是我方手牌，同步到持久牌組
  finishHandEdit(id)
}

// 填完手牌數值後的後續：若有等待中的落子（未知卡先填再落），執行它。
function finishHandEdit(cardId: number) {
  const cell = pendingPlaceCell.value
  cancelEdit()
  if (cell !== null) {
    pendingPlaceCell.value = null
    // 此時該手牌已是已知卡，正常落子結算。
    selectedCardId.value = cardId
    doPlace(cell, cardId)
  }
}

function currentHand(): Card[] {
  return turn.value === 'RED' ? redHand.value : blueHand.value
}

function selectCard(cardId: number) {
  // 調換模式：點牌是選要對調的槽位，不是選落子。
  if (moveMode.value) {
    movePickHand(cardId)
    return
  }
  // 交換模式：點牌是選互換對象，不是選落子。
  if (swapMode.value) {
    swapPick(cardId)
    return
  }
  selectedCardId.value = selectedCardId.value === cardId ? null : cardId
  suggestedCell.value = null
}

function buildState(): GameState {
  return {
    board: board.value,
    redHand: redHand.value,
    blueHand: blueHand.value,
    turn: turn.value,
    rules,
  }
}

// 記住「填完未知卡數值後要落子的目標格」。
const pendingPlaceCell = ref<number | null>(null)

function placeCard(cellIndex: number) {
  // 調換模式：點格子是選要搬動/對調的格，不是落子。
  if (moveMode.value) {
    movePickCell(cellIndex)
    return
  }
  if (selectedCardId.value === null) return
  if (board.value[cellIndex]!.card !== null) return

  // 若選的是未知卡，先填數值再落子：
  // 記住目標格，打開該手牌的編輯面板，填完數值後自動落子。
  const selCard =
    redHand.value.find((c) => c.id === selectedCardId.value) ??
    blueHand.value.find((c) => c.id === selectedCardId.value)
  if (selCard?.unknown) {
    pendingPlaceCell.value = cellIndex
    startEdit(selectedCardId.value) // 開編輯面板填這張未知手牌
    return
  }

  doPlace(cellIndex, selectedCardId.value)
}

// 實際落子（數值已確定）。
function doPlace(cellIndex: number, cardId: number) {
  const next = applyMove(buildState(), { cardId, cellIndex })

  board.value = next.board
  redHand.value = next.redHand
  blueHand.value = next.blueHand
  turn.value = next.turn

  selectedCardId.value = null
  suggestedCell.value = null
  suggestionText.value = ''
}

// ---------- 建議最佳手 ----------
const thinking = ref(false)
// 算一張卡的顯示用四邊（強化/弱化加成後），供手牌與棋盤即時顯示。
// 未啟用強化/弱化時，effectiveEdges 會回原值，等於不變。
function displayEdgesFor(card: Card): Edges {
  return effectiveEdges(card, board.value, rules)
}

// ---------- 開局建議快取（僅本次網頁工作階段）----------
// 空盤第一手的搜尋最深最慢，但同一組（規則、輪次、雙方手牌內容）的結果
// 是確定的，而打同一個 NPC 會反覆遇到同樣的開局：第一局算一次，之後同開局
// 直接取快取瞬間回覆。鍵用「手牌內容簽名」不用卡 id（未知卡 id 每局重發
// 都不同）；著手存「手牌位置索引」，命中時換算回當局的卡 id。
// 混亂規則不快取（被指定的牌每局隨機）。
interface OpeningCacheEntry {
  handIndex: number // 建議牌在當時「當前玩家手牌」中的位置
  cellIndex: number
  score: number
  samples: number
  mode: MonteCarloResult['mode']
  candidates: number
}
const openingCache = new Map<string, OpeningCacheEntry>()

function openingKey(): string {
  const sig = (c: Card) =>
    c.unknown
      ? 'U'
      : `${c.edges.top},${c.edges.right},${c.edges.bottom},${c.edges.left},${c.type ?? ''}`
  return JSON.stringify({
    rules: { ...rules },
    opponent: opponentSpec.value,
    turn: turn.value,
    red: redHand.value.map(sig),
    blue: blueHand.value.map(sig),
  })
}

function suggestBest() {
  if (isGameOver(buildState())) {
    suggestionText.value = '對局已結束'
    return
  }

  // 混亂規則：這一手只能出遊戲隨機指定的那張牌。
  // 你先點選被指定的牌，建議只算「那張牌」的最佳落點。
  const chaosCardId = rules.chaos ? selectedCardId.value : null
  if (rules.chaos && chaosCardId === null) {
    suggestionText.value = '混亂規則：請先點選這一手被指定的牌，再按建議'
    return
  }

  thinking.value = true
  suggestedCell.value = null

  setTimeout(() => {
    // 有未知卡：蒙地卡羅抽樣（從真實卡池抽對手可能的牌，跨樣本平均選最穩落點；
    // 深盤面搜尋過重時自動退回估計卡精確搜尋）。無未知卡：內部直接走精確搜尋。
    // 排除「對手已亮出的牌」不參與抽樣：牌組記憶 + 對手手牌中已填值的卡
    // （後者涵蓋交換不寫回牌組的情況）。同副牌組不會有重複卡。
    const oppHandNow = mySide.value === 'RED' ? blueHand.value : redHand.value
    const excludeCards = [
      ...oppDeck.value.filter((c): c is Card => c !== null),
      ...oppHandNow.filter((c) => !c.unknown),
    ]
    // 空盤（開局第一手）且非混亂：查/寫開局快取。
    const boardEmpty = board.value.every((c) => c.card === null)
    const cacheKey = boardEmpty && chaosCardId === null ? openingKey() : null
    const cached = cacheKey !== null ? openingCache.get(cacheKey) : undefined
    let result: MonteCarloResult
    if (cached) {
      // 命中：把「手牌位置索引」換算回當局的卡 id。空盤時手牌必為滿 5 張。
      result = {
        move: { cardId: currentHand()[cached.handIndex]!.id, cellIndex: cached.cellIndex },
        score: cached.score,
        samples: cached.samples,
        mode: cached.mode,
        candidates: cached.candidates,
      }
    } else {
      result = findBestMoveMonteCarlo(buildState(), {
        excludeCards,
        restrictToCardId: chaosCardId ?? undefined,
        opponent: opponentSpec.value,
      })
      if (cacheKey !== null && result.move) {
        const hi = currentHand().findIndex((c) => c.id === result.move!.cardId)
        if (hi !== -1) {
          openingCache.set(cacheKey, {
            handIndex: hi,
            cellIndex: result.move.cellIndex,
            score: result.score,
            samples: result.samples,
            mode: result.mode,
            candidates: result.candidates,
          })
        }
      }
    }
    if (result.move) {
      suggestedCell.value = result.move.cellIndex
      selectedCardId.value = result.move.cardId
      const card = currentHand().find((c) => c.id === result.move!.cardId)
      // 分數是紅視角；換算成「我方視角」更直覺。
      const myScore = mySide.value === 'RED' ? result.score : -result.score
      const sign = myScore > 0 ? '我方優' : myScore < 0 ? '對手優' : '均勢'
      // 標示這手是幫誰算的（輪到對手時，等於預測對手最佳應對）。
      const forWho = turn.value === mySide.value ? '我方' : '對手'
      // 依計算模式標註：抽樣平均（分數可能非整數）／估計卡／精確（不標）。
      // 候選數＝對手未知牌還剩幾種可能。數字小＝推論收得緊＝這個分數可信；
      // uniform（沒指定對手）時是幾百，正好提醒使用者分數偏樂觀。
      const candNote = result.mode === 'exact' ? '' : `，對手候選 ${result.candidates} 張`
      const modeNote =
        result.mode === 'sampled'
          ? `（蒙地卡羅 ${result.samples} 樣本平均${candNote}）`
          : result.mode === 'estimate'
            ? `（估計${candNote}）`
            : ''
      const chaosNote = chaosCardId !== null ? '【混亂：僅算指定牌落點】' : ''
      const scoreText = Number.isInteger(myScore) ? `${myScore}` : myScore.toFixed(2)
      suggestionText.value =
        `${chaosNote}（${forWho}）建議出「${card?.name ?? '?'}」→ ${describeCell(result.move.cellIndex)}` +
        `　預期終局 ${myScore >= 0 ? '+' : ''}${scoreText}（${sign}）${modeNote}`
    }
    thinking.value = false
  }, 20)
}

function describeCell(i: number): string {
  const rows = ['上', '中', '下']
  const cols = ['左', '中', '右']
  return `${rows[Math.floor(i / 3)]}${cols[i % 3]}格`
}

// ---------- 重置 ----------
// 沿用目前開局設定的先手方，重發牌、清空棋盤。
function reset() {
  resetBoard()
}

// ---------- 計分與勝負 ----------
const score = computed(() => {
  let red = redHand.value.length
  let blue = blueHand.value.length
  for (const c of board.value) {
    if (c.owner === 'RED') red++
    else if (c.owner === 'BLUE') blue++
  }
  return { red, blue }
})

const gameOver = computed(() => isGameOver(buildState()))
const winner = computed(() => (gameOver.value ? getWinner(buildState()) : null))

// ---------- 顯示用手牌槽 ----------
// 維持原始 5 格位置：每格對應原始手牌一個 id。
// 用該 id 去當前手牌找——找到=未出（顯示當前卡，含編輯後數值），
// 找不到=已出（顯示灰框佔位）。
interface HandSlot {
  card: Card | null // 未出時的當前卡；已出為 null
  played: boolean // 是否已出掉
}
function buildSlots(orig: Card[], current: Card[]): HandSlot[] {
  return orig.map((o) => {
    const live = current.find((c) => c.id === o.id)
    return live ? { card: live, played: false } : { card: null, played: true }
  })
}
const redSlots = computed(() => buildSlots(redHandOrig.value, redHand.value))
const blueSlots = computed(() => buildSlots(blueHandOrig.value, blueHand.value))

// 落子可行性：已選卡且該格為空。
// 但當「建議最佳手」的金色聚光正在顯示時，不讓其他空格泛金色，
// 讓畫面只聚焦在被建議的那一格。
function isPlaceable(cell: Cell, index: number): boolean {
  // 調換模式：還沒選第一格時只有「有卡的格」可點，選了之後除自己外都可點。
  if (moveMode.value) {
    return moveFirst.value === null ? cell.card !== null : pickedCell.value !== index
  }
  if (suggestedCell.value !== null) return false
  return selectedCardId.value !== null && cell.card === null
}
</script>

<template>
  <div class="saucer">
    <!-- 頁首 + 規則列 -->
    <header class="topbar">
      <h1 class="title">金碟幻卡<span class="title-sub">· 分析台</span></h1>
      <RuleBar :rules="rules" @update:rules="updateRules" />
    </header>

    <!-- 開局設定：我方座位、開局先手（兩者獨立） -->
    <div class="setup-bar">
      <div class="setup-group">
        <span class="setup-label">我方座位</span>
        <div class="seg">
          <button class="seg-btn red" :class="{ on: mySide === 'RED' }" @click="setMySide('RED')">
            紅方
          </button>
          <button
            class="seg-btn blue"
            :class="{ on: mySide === 'BLUE' }"
            @click="setMySide('BLUE')"
          >
            藍方
          </button>
        </div>
      </div>

      <div class="setup-group">
        <span class="setup-label">開局先手</span>
        <div class="seg">
          <button
            class="seg-btn red"
            :class="{ on: firstPlayer === 'RED' }"
            @click="setFirst('RED')"
          >
            紅先
          </button>
          <button
            class="seg-btn blue"
            :class="{ on: firstPlayer === 'BLUE' }"
            @click="setFirst('BLUE')"
          >
            藍先
          </button>
        </div>
      </div>

      <span class="setup-hint">調整紅藍方、先後手及規則會重置牌局</span>
    </div>

    <div class="stage">
      <!-- 左側：雙方手牌 -->
      <aside class="hands">
        <HandPanel
          player="BLUE"
          :slots="blueSlots"
          :score="score.blue"
          :selected-card-id="selectedCardId"
          :is-active="turn === 'BLUE'"
          :editable="true"
          :editing-card-id="editingCardId"
          :swap-mode="swapMode || moveMode"
          :swap-first-id="swapMode ? swapFirstId : moveFirstCardId"
          :display-edges-for="displayEdgesFor"
          @select="selectCard"
          @edit="startEdit"
        />
        <HandPanel
          player="RED"
          :slots="redSlots"
          :score="score.red"
          :selected-card-id="selectedCardId"
          :is-active="turn === 'RED'"
          :editable="true"
          :editing-card-id="editingCardId"
          :swap-mode="swapMode || moveMode"
          :swap-first-id="swapMode ? swapFirstId : moveFirstCardId"
          :display-edges-for="displayEdgesFor"
          @select="selectCard"
          @edit="startEdit"
        />
        <div class="hand-tools">
          <button v-if="rules.swap && !swapMode && !moveMode" class="swap-btn" @click="startSwap">
            指定交換
          </button>
          <div v-if="swapMode" class="swap-hint">
            {{ swapFirstId === null ? '① 點我方要換出的牌' : '② 點對手要換進的牌' }}
            <button class="swap-cancel" @click="cancelSwap">取消</button>
          </div>

          <!-- 調換位置：修正填錯的槽位／放錯的格子，秩序規則下也用來對齊手牌順序 -->
          <button v-if="!moveMode && !swapMode" class="move-btn" @click="startMove">
            調換位置
          </button>
          <div v-if="moveMode" class="move-hint">
            {{
              moveFirst === null
                ? '點一張手牌或棋盤上的卡'
                : moveFirst.kind === 'hand'
                  ? '再點同一方的另一張手牌完成對調'
                  : '再點另一格：有卡是互換，空格是搬過去'
            }}
            <button class="move-cancel" @click="cancelMove">完成</button>
          </div>
          <button class="clear-opp-btn" @click="clearOppDeck">洗掉對手牌</button>
        </div>

        <details class="fold" :open="!narrow">
          <summary class="fold-summary">對手牌組・牌組槽</summary>
          <div class="fold-body">
            <!-- 對手牌組模型：決定未知牌從哪裡抽，直接影響建議與分數可信度 -->
            <div class="opp-model">
              <div class="opp-model-title">對手牌組</div>
              <div class="opp-model-kinds">
                <button
                  v-for="k in ['uniform', 'npc', 'player'] as const"
                  :key="k"
                  class="opp-model-kind"
                  :class="{ active: oppKind === k }"
                  @click="oppKind = k"
                >
                  {{ k === 'uniform' ? '不指定' : k === 'npc' ? 'NPC' : '玩家' }}
                </button>
              </div>
              <template v-if="oppKind === 'npc'">
                <div v-if="selectedNpc" class="opp-model-picked">
                  {{ selectedNpc.nameZh ?? selectedNpc.name }}
                  <span class="opp-model-rules">{{
                    selectedNpc.rules.join('・') || '無特殊規則'
                  }}</span>
                  <button class="opp-model-clear" @click="oppNpcId = null">×</button>
                </div>
                <input
                  v-else
                  v-model="npcQuery"
                  class="opp-model-search"
                  placeholder="輸入 NPC 名稱搜尋（中英皆可）"
                />
                <div v-if="!selectedNpc && npcMatches.length > 0" class="opp-model-list">
                  <button
                    v-for="n in npcMatches"
                    :key="n.id"
                    class="opp-model-item"
                    @click="pickNpc(n.id)"
                  >
                    {{ n.nameZh ?? n.name }}
                    <span class="opp-model-rules">
                      {{ n.nameZh ? n.name + '　' : '' }}{{ n.rules.join('・') }}
                    </span>
                  </button>
                </div>
              </template>
              <div class="opp-model-note">
                {{
                  oppKind === 'npc'
                    ? selectedNpc
                      ? '用該 NPC 的實際牌組抽樣'
                      : '尚未選 NPC，暫時當作不指定'
                    : oppKind === 'player'
                      ? '依牌組規則限制星級，填充位假設為強 3★'
                      : '從全卡池均勻抽，分數會偏樂觀'
                }}
              </div>
            </div>

            <!-- 牌組儲存槽（僅本次開啟網頁期間有效，重新整理即消失） -->
            <div class="deck-slots">
              <div class="deck-slots-title">
                牌組槽<span class="deck-slots-note">（本次開啟有效）</span>
              </div>
              <div class="deck-slots-group">
                <span class="deck-slots-label">我方</span>
                <div
                  v-for="(s, i) in myDeckSlots"
                  :key="'m' + i"
                  class="deck-slot"
                  :class="{ filled: s.deck }"
                >
                  <input v-model="s.name" class="deck-slot-name" :placeholder="`槽 ${i + 1}`" />
                  <button
                    class="deck-slot-btn"
                    title="把目前我方牌組存進此槽"
                    @click="saveMySlot(i)"
                  >
                    存
                  </button>
                  <button
                    class="deck-slot-btn"
                    title="取回此槽牌組並重發牌局"
                    :disabled="!s.deck"
                    @click="loadMySlot(i)"
                  >
                    取
                  </button>
                </div>
              </div>
              <div class="deck-slots-group">
                <span class="deck-slots-label">對手</span>
                <div
                  v-for="(s, i) in oppDeckSlots"
                  :key="'o' + i"
                  class="deck-slot"
                  :class="{ filled: s.deck }"
                >
                  <input v-model="s.name" class="deck-slot-name" :placeholder="`槽 ${i + 1}`" />
                  <button
                    class="deck-slot-btn"
                    title="把目前對手牌組記憶存進此槽"
                    @click="saveOppSlot(i)"
                  >
                    存
                  </button>
                  <button
                    class="deck-slot-btn"
                    title="取回此槽牌組並重發牌局"
                    :disabled="!s.deck"
                    @click="loadOppSlot(i)"
                  >
                    取
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>
      </aside>

      <!-- 中央：棋盤 + 控制 -->
      <main class="center">
        <div class="turn-indicator">
          <template v-if="gameOver">
            <span :class="winner === 'RED' ? 'red' : winner === 'BLUE' ? 'blue' : ''">
              {{ winner === 'RED' ? '紅方勝' : winner === 'BLUE' ? '藍方勝' : '平手' }}
            </span>
          </template>
          <template v-else>
            輪到
            <span :class="turn === 'RED' ? 'red' : 'blue'">{{
              turn === 'RED' ? '紅方' : '藍方'
            }}</span>
          </template>
        </div>

        <div class="board">
          <BoardCell
            v-for="(cell, i) in board"
            :key="i"
            :cell="cell"
            :suggested="suggestedCell === i"
            :placeable="isPlaceable(cell, i)"
            :picked="pickedCell === i"
            :editing="editingCellIndex === i"
            :display-edges="cell.card ? displayEdgesFor(cell.card) : undefined"
            @place="placeCard(i)"
            @edit="startEditCell(i)"
          />
        </div>

        <div class="controls">
          <button class="btn primary" :disabled="thinking || gameOver" @click="suggestBest">
            {{ thinking ? '推演中…' : '建議最佳手' }}
          </button>
          <button class="btn ghost" @click="reset">重置牌局</button>
        </div>

        <p class="suggestion" v-if="suggestionText">{{ suggestionText }}</p>
      </main>
    </div>

    <!-- 搜尋選卡 / 手動輸入面板（彈窗） -->
    <CardPicker
      v-if="editingCardId !== null || editingCellIndex !== null"
      :card="editingCard"
      :pool="pickerPool"
      :pool-note="pickerPoolNote"
      @pick="pickCard"
      @manual="applyManual"
      @cancel="cancelPicker"
    />
  </div>
</template>

<style scoped>
/* ---------- FF14 金碟賭場風格（碳灰 + 面板層次） ---------- */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Noto+Serif+TC:wght@500;700&family=JetBrains+Mono:wght@600&display=swap');

.saucer {
  --bg: #1a1a1c;
  --panel: #2b2b2e;
  --panel-2: #242427;
  --slot: #1c1c1e;
  --ivory: #f0ead9;
  --gold: #d9b449;
  --gold-dim: #8a7740;
  --red: #c14d42;
  --red-deep: #9e3a30;
  --blue: #4a82ad;
  --blue-deep: #356488;
  --line: #3a3a3e;

  min-height: 100vh;
  background: var(--bg);
  color: var(--ivory);
  font-family: 'Noto Serif TC', serif;
  padding: 24px clamp(16px, 4vw, 48px);
  box-sizing: border-box;
}

/* 頁首 */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid var(--gold-dim);
  padding-bottom: 16px;
  margin-bottom: 24px;
}
.title {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: clamp(22px, 3vw, 30px);
  letter-spacing: 2px;
  margin: 0;
  color: var(--gold);
  text-shadow: 0 0 12px rgba(217, 180, 73, 0.3);
}
.title-sub {
  font-size: 0.6em;
  color: var(--ivory);
  opacity: 0.7;
  margin-left: 8px;
  letter-spacing: 1px;
}

/* 開局設定列 */
.setup-bar {
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding: 14px 18px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.setup-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.setup-label {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--ivory);
  opacity: 0.85;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.seg-btn {
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  padding: 7px 16px;
  cursor: pointer;
  background: transparent;
  color: var(--ivory);
  border: none;
  transition: all 0.15s;
}
.seg-btn:not(:last-child) {
  border-right: 1px solid var(--line);
}
.seg-btn.red.on {
  background: var(--red);
  color: #fff;
  font-weight: 700;
}
.seg-btn.blue.on {
  background: var(--blue);
  color: #fff;
  font-weight: 700;
}
.seg-btn:not(.on):hover {
  background: rgba(255, 255, 255, 0.05);
}
.setup-hint {
  font-size: 14px;
  color: var(--ivory);
  opacity: 0.6;
  margin-left: auto;
}

/* 舞台 */
.stage {
  display: grid;
  grid-template-columns: minmax(200px, 264px) 1fr;
  gap: clamp(16px, 3vw, 32px);
  align-items: start;
}

/* 左面板：手牌 */
.hands {
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px;
}
/* 模式按鈕群（指定交換／調換位置／洗掉對手牌） */
.hand-tools {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 摺疊區：桌面版常開且不顯示標題，手機版可收合 */
.fold-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.fold-summary {
  display: none;
}
.clear-opp-btn {
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  padding: 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
  transition: all 0.15s;
}
.clear-opp-btn:hover {
  border-color: var(--red);
  background: rgba(193, 77, 66, 0.12);
}
.swap-btn {
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  padding: 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  color: var(--gold);
  border: 1px solid var(--gold-dim);
  transition: all 0.15s;
}
.swap-btn:hover {
  border-color: var(--gold);
  background: rgba(217, 180, 73, 0.1);
}
.swap-hint {
  font-size: 13px;
  color: var(--gold);
  text-align: center;
  padding: 8px;
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.swap-cancel {
  font-size: 12px;
  padding: 4px 12px;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
}

/* ---------- 調換位置 ---------- */
/* 與「指定交換」視覺上刻意區隔：交換是規則行為（實線金框），
   調換是輸入更正工具（虛線），避免誤以為在用交換規則。 */
.move-btn {
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  padding: 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  color: var(--ivory);
  border: 1px dashed var(--line);
  transition: all 0.15s;
}
.move-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.move-hint {
  font-size: 13px;
  color: var(--gold);
  text-align: center;
  padding: 8px;
  border: 1px dashed var(--gold-dim);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.move-cancel {
  font-size: 12px;
  padding: 4px 12px;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
}

/* 右面板：棋盤 + 控制 */
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 20px;
}
.turn-indicator {
  font-family: 'Cinzel', serif;
  font-size: 24px;
  letter-spacing: 3px;
}
.turn-indicator .red {
  color: #e08b82;
  font-weight: 700;
}
.turn-indicator .blue {
  color: #8fb8da;
  font-weight: 700;
}

/* 棋盤 */
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 14px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow:
    inset 0 0 24px rgba(0, 0, 0, 0.45),
    0 6px 18px rgba(0, 0, 0, 0.3);
}

/* 控制 */
.controls {
  display: flex;
  gap: 12px;
}
.btn {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 15px;
  letter-spacing: 1px;
  padding: 10px 22px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--gold-dim);
}
.btn.primary {
  background: linear-gradient(160deg, var(--gold), #a8841d);
  color: #1a1408;
  font-weight: 700;
  border-color: var(--gold);
}
.btn.primary:hover:not(:disabled) {
  box-shadow: 0 0 18px rgba(217, 180, 73, 0.5);
  transform: translateY(-1px);
}
.btn.primary:disabled {
  opacity: 0.5;
  cursor: wait;
}
.btn.ghost {
  background: transparent;
  color: var(--ivory);
}
.btn.ghost:hover {
  border-color: var(--ivory);
  background: rgba(255, 255, 255, 0.05);
}

.suggestion {
  font-size: 15px;
  color: var(--gold);
  text-align: center;
  margin: 0;
  min-height: 1.2em;
  letter-spacing: 0.5px;
}

/* 響應式 */
@media (max-width: 720px) {
  .saucer {
    padding: 12px 12px 32px;
  }
  .topbar {
    gap: 10px;
    padding-bottom: 12px;
    margin-bottom: 14px;
  }
  .setup-bar {
    gap: 10px 20px;
    padding: 10px 12px;
    margin-bottom: 14px;
  }
  .setup-hint {
    flex-basis: 100%;
    margin-left: 0;
    font-size: 12px;
  }

  /* 單欄堆疊：棋盤 → 手牌 → 模式按鈕 → 摺疊區。
     .hands 用 display: contents 讓子元素直接參與排序。 */
  .stage {
    display: flex;
    flex-direction: column;
    align-items: stretch; /* 桌面版的 start 會讓子區塊縮成內容寬 */
    gap: 12px;
  }
  .hands {
    display: contents;
  }
  .center {
    order: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 14px 10px 16px;
    gap: 12px;
  }
  .hand-group {
    order: 1;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
  }
  .hand-tools {
    order: 2;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }
  .hand-tools > button {
    flex: 1 1 auto;
    padding: 11px 10px;
  }
  .swap-hint,
  .move-hint {
    flex-basis: 100%;
  }
  .fold {
    order: 3;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
  }
  .fold-body {
    gap: 12px;
    margin-top: 8px;
  }
  .fold-summary {
    display: list-item;
    cursor: pointer;
    font-family: 'Cinzel', 'Noto Serif TC', serif;
    font-size: 13px;
    letter-spacing: 1px;
    color: var(--gold);
    padding: 4px 0;
  }

  .turn-indicator {
    font-size: 20px;
  }
  .board {
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    gap: 6px;
  }
  .controls {
    width: 100%;
  }
  .btn {
    flex: 1;
    padding: 12px 0;
  }
  .suggestion {
    font-size: 14px;
  }
}
/* ---------- 牌組儲存槽 ---------- */
/* ---------- 對手牌組模型 ---------- */
.opp-model {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opp-model-title {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 13px;
  color: var(--gold);
  letter-spacing: 1px;
}
.opp-model-kinds {
  display: flex;
  gap: 6px;
}
.opp-model-kind {
  flex: 1;
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  padding: 5px 0;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
  transition: all 0.15s;
}
.opp-model-kind:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.opp-model-kind.active {
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(217, 180, 73, 0.12);
}
.opp-model-search {
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--panel);
  color: var(--ivory);
  border: 1px solid var(--line);
  outline: none;
}
.opp-model-search:focus {
  border-color: var(--gold);
}
.opp-model-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 180px;
  overflow-y: auto;
}
.opp-model-item {
  text-align: left;
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  background: var(--panel);
  color: var(--ivory);
  border: 1px solid var(--line);
  transition: all 0.15s;
}
.opp-model-item:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.opp-model-picked {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  color: var(--gold);
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--panel);
  border: 1px solid var(--gold-dim);
}
.opp-model-rules {
  flex: 1;
  font-size: 11px;
  color: var(--ivory);
  opacity: 0.55;
}
.opp-model-clear {
  background: transparent;
  border: none;
  color: var(--ivory);
  opacity: 0.6;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.opp-model-clear:hover {
  color: var(--red);
  opacity: 1;
}
.opp-model-note {
  font-family: 'Noto Serif TC', serif;
  font-size: 11px;
  color: var(--ivory);
  opacity: 0.55;
}
.deck-slots {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.deck-slots-title {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 13px;
  color: var(--gold);
  letter-spacing: 1px;
}
.deck-slots-note {
  font-family: 'Noto Serif TC', serif;
  font-size: 11px;
  color: var(--ivory);
  opacity: 0.55;
  letter-spacing: 0;
}
.deck-slots-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.deck-slots-label {
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  color: var(--ivory);
  opacity: 0.7;
}
.deck-slot {
  display: flex;
  align-items: center;
  gap: 6px;
}
.deck-slot-name {
  flex: 1;
  min-width: 0;
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--panel);
  color: var(--ivory);
  border: 1px solid var(--line);
  outline: none;
}
.deck-slot.filled .deck-slot-name {
  border-color: var(--gold-dim);
}
.deck-slot-name:focus {
  border-color: var(--gold);
}
.deck-slot-btn {
  font-family: 'Noto Serif TC', serif;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
  transition: all 0.15s;
}
.deck-slot-btn:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold);
}
.deck-slot-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
