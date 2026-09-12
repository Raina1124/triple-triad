<script setup lang="ts">
// ============================================================
// CardPicker.vue — 搜尋選卡 + 手動輸入（二合一彈窗）
// 上半：搜尋卡庫（編號 / 英文名 / 中文名），點選即填入。
// 下半：手動輸入四邊數值（搜不到的卡或臨時微調用）。
// ============================================================
import { ref, computed, watch, onMounted } from 'vue'
import type { Card, EdgeValue } from '../engine/types'
import { CARD_POOL } from '../engine/card-pool'

interface Props {
  card: Card | null // 目前卡位上的卡（可能為 null＝未知/空）
  // 候選卡池。不傳＝全卡池。呼叫端在「已知對手是誰」時可收斂範圍，
  // 例如填對手手牌且對手是指定的 NPC，就只給該 NPC 的牌組。
  pool?: Card[]
  poolNote?: string // 篩選來源說明；有值才顯示提示列與「顯示全部」開關
}

const props = defineProps<Props>()

// 收斂的卡池可以被使用者手動解除：牌組資料可能因改版過期，或選錯了 NPC，
// 沒有退路的話會卡死在填不進去。
const showAllPool = ref(false)
const activePool = computed<Card[]>(() =>
  props.pool && !showAllPool.value ? props.pool : CARD_POOL,
)

const emit = defineEmits<{
  (e: 'pick', card: Card): void // 從卡庫選了一張
  (
    e: 'manual',
    edges: { top: EdgeValue; right: EdgeValue; bottom: EdgeValue; left: EdgeValue },
  ): void
  (e: 'cancel'): void
}>()

// ---------- 搜尋 ----------
const keyword = ref('')

// 種族篩選（'' = 全部）。對照表同時提供顯示用中文。
const typeFilter = ref<string>('')
const typeOptions: { value: string; label: string }[] = [
  { value: '', label: '全部種族' },
  { value: 'none', label: '無' },
  { value: 'primal', label: '蠻神' },
  { value: 'scion', label: '拂曉' },
  { value: 'garlean', label: '帝國' },
  { value: 'beastman', label: '獸人' },
]

// 用數值找卡：四個邊各自的篩選值（空 = 不限該邊）。
const fTop = ref<string>('')
const fRight = ref<string>('')
const fBottom = ref<string>('')
const fLeft = ref<string>('')

// 清除數值反查的四個輸入。
function clearStats() {
  fTop.value = ''
  fRight.value = ''
  fBottom.value = ''
  fLeft.value = ''
}

// 把輸入轉成數字或 null（空/非法 = null，代表不限）。
// 同時安全處理字串與數字型別（type=number 的 v-model 可能傳回數字）。
function toNum(s: string | number | null | undefined): number | null {
  if (s == null) return null
  const str = String(s).trim()
  if (str === '') return null
  const n = Number(str)
  if (isNaN(n)) return null
  return n
}

// 模糊搜尋：依關鍵字（編號/英文名/中文名）、種族、數值反查綜合篩選。
const results = computed<Card[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const tf = typeFilter.value
  // 數值反查：只要欄位有填就納入篩選，不依賴開關狀態。
  const wantTop = toNum(fTop.value)
  const wantRight = toNum(fRight.value)
  const wantBottom = toNum(fBottom.value)
  const wantLeft = toNum(fLeft.value)

  const list = activePool.value.filter((c) => {
    // 種族篩選。
    if (tf !== '' && (c.type ?? 'none') !== tf) return false

    // 數值反查：有指定的邊必須相符。
    if (wantTop != null && c.edges.top !== wantTop) return false
    if (wantRight != null && c.edges.right !== wantRight) return false
    if (wantBottom != null && c.edges.bottom !== wantBottom) return false
    if (wantLeft != null && c.edges.left !== wantLeft) return false

    // 關鍵字（編號 / 英文名 / 中文名）。
    if (kw !== '') {
      const hitName = c.name.toLowerCase().includes(kw)
      const hitZh = c.nameZh ? c.nameZh.includes(kw) : false
      const hitNo = c.cardNo != null && String(c.cardNo).includes(kw)
      if (!hitName && !hitZh && !hitNo) return false
    }
    return true
  })

  return list.slice(0, 60)
})

function pick(card: Card) {
  emit('pick', card)
}

// 數值搜尋自動套用：當四邊數值都填入，且符合的卡剛好「唯一一張」時，
// 直接套用、省去再點一次。只在四邊皆填時觸發（代表使用者完整輸入一張卡）。
watch([fTop, fRight, fBottom, fLeft], () => {
  const t = toNum(fTop.value)
  const r = toNum(fRight.value)
  const b = toNum(fBottom.value)
  const l = toNum(fLeft.value)
  // 必須四邊都填了才考慮自動套用。
  if (t == null || r == null || b == null || l == null) return
  // 找出四邊完全相符的卡（也尊重種族篩選，但不限關鍵字）。
  const tf = typeFilter.value
  const matches = activePool.value.filter(
    (c) =>
      c.edges.top === t &&
      c.edges.right === r &&
      c.edges.bottom === b &&
      c.edges.left === l &&
      (tf === '' || (c.type ?? 'none') === tf),
  )
  if (matches.length === 1) {
    emit('pick', matches[0]!)
  }
})

// ---------- 手動輸入（備案） ----------
const showManual = ref(false)
const top = ref<string>(props.card ? String(props.card.edges.top) : '5')
const right = ref<string>(props.card ? String(props.card.edges.right) : '5')
const bottom = ref<string>(props.card ? String(props.card.edges.bottom) : '5')
const left = ref<string>(props.card ? String(props.card.edges.left) : '5')

function clampLive(s: string): string {
  if (s === '' || s === '-') return s
  const n = Number(s)
  if (isNaN(n)) return s
  if (n > 10) return '10'
  if (n < 1) return '1'
  return s
}
watch(top, (v) => {
  const c = clampLive(v)
  if (c !== v) top.value = c
})
watch(right, (v) => {
  const c = clampLive(v)
  if (c !== v) right.value = c
})
watch(bottom, (v) => {
  const c = clampLive(v)
  if (c !== v) bottom.value = c
})
watch(left, (v) => {
  const c = clampLive(v)
  if (c !== v) left.value = c
})

function clampFinal(s: string): EdgeValue {
  let n = Math.round(Number(s))
  if (isNaN(n)) n = 1
  if (n < 1) n = 1
  if (n > 10) n = 10
  return n as EdgeValue
}

function applyManual() {
  emit('manual', {
    top: clampFinal(top.value),
    right: clampFinal(right.value),
    bottom: clampFinal(bottom.value),
    left: clampFinal(left.value),
  })
}

// 顯示卡名：優先中文，其次英文。
function displayName(c: Card): string {
  return c.nameZh ?? c.name
}

// 搜尋框自動聚焦只在有實體鍵盤的裝置做；觸控裝置一聚焦就彈鍵盤，
// 會蓋掉半個清單，而 NPC 模式收斂後的卡池根本不需要打字。
const searchInput = ref<HTMLInputElement | null>(null)
onMounted(() => {
  if (!window.matchMedia('(pointer: coarse)').matches) searchInput.value?.focus()
})
</script>

<template>
  <div class="picker-backdrop" @click.self="emit('cancel')">
    <div class="picker">
      <div class="picker-title">選擇卡牌</div>

      <!-- 卡池已收斂時的提示（例：對手是指定的 NPC，只列該 NPC 的牌組） -->
      <div v-if="poolNote" class="pool-note">
        <span>{{ showAllPool ? '已解除篩選，顯示全部卡池' : poolNote }}</span>
        <button class="pool-toggle" @click="showAllPool = !showAllPool">
          {{ showAllPool ? '回到篩選' : '顯示全部' }}
        </button>
      </div>

      <!-- 搜尋 -->
      <input
        class="search-input"
        type="text"
        v-model="keyword"
        placeholder="輸入編號或卡名搜尋…"
        ref="searchInput"
      />

      <!-- 篩選列：種族 + 數值反查切換 -->
      <div class="filter-row">
        <select class="type-select" v-model="typeFilter">
          <option v-for="o in typeOptions" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>

      <!-- 數值反查輸入（常駐，有填才篩選） -->
      <div class="stats-filter">
        <span class="sf-hint">用數值找卡（填入已知的邊，空白=不限）：</span>
        <div class="sf-cross">
          <input
            class="sf-input sf-t"
            type="number"
            min="1"
            max="10"
            v-model="fTop"
            placeholder="上"
          />
          <input
            class="sf-input sf-l"
            type="number"
            min="1"
            max="10"
            v-model="fLeft"
            placeholder="左"
          />
          <div class="sf-center"></div>
          <input
            class="sf-input sf-r"
            type="number"
            min="1"
            max="10"
            v-model="fRight"
            placeholder="右"
          />
          <input
            class="sf-input sf-b"
            type="number"
            min="1"
            max="10"
            v-model="fBottom"
            placeholder="下"
          />
        </div>
        <button class="sf-clear" @click="clearStats">清除數值</button>
      </div>

      <div class="results">
        <button v-for="c in results" :key="c.id" class="result-row" @click="pick(c)">
          <span class="r-no">No.{{ c.cardNo ?? '?' }}</span>
          <span class="r-id">id:{{ c.id }}</span>
          <span class="r-name">{{ displayName(c) }}</span>
          <span class="r-stars">{{ '★'.repeat(c.stars) }}</span>
          <span class="r-edges">
            {{ c.edges.top }}/{{ c.edges.right }}/{{ c.edges.bottom }}/{{ c.edges.left }}
          </span>
        </button>
        <div v-if="results.length === 0" class="no-result">找不到符合的卡牌</div>
      </div>

      <!-- 手動輸入（折疊） -->
      <button class="manual-toggle" @click="showManual = !showManual">
        {{ showManual ? '▲ 收起手動輸入' : '▼ 找不到？手動輸入數值' }}
      </button>

      <div v-if="showManual" class="manual">
        <div class="cross">
          <input
            class="edge-input pos-t"
            type="number"
            min="1"
            max="10"
            v-model="top"
            aria-label="上"
          />
          <input
            class="edge-input pos-l"
            type="number"
            min="1"
            max="10"
            v-model="left"
            aria-label="左"
          />
          <div class="cross-center">A=10</div>
          <input
            class="edge-input pos-r"
            type="number"
            min="1"
            max="10"
            v-model="right"
            aria-label="右"
          />
          <input
            class="edge-input pos-b"
            type="number"
            min="1"
            max="10"
            v-model="bottom"
            aria-label="下"
          />
        </div>
        <button class="btn primary" @click="applyManual">套用數值</button>
      </div>

      <div class="picker-actions">
        <button class="btn ghost" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.picker {
  background: var(--panel);
  border: 1px solid var(--gold-dim);
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  width: 420px;
  max-width: 92vw;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.picker-title {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 18px;
  letter-spacing: 2px;
  color: var(--gold);
  text-align: center;
  margin-bottom: 16px;
}
.pool-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--gold);
  padding: 6px 8px;
  margin-bottom: 10px;
  border: 1px dashed var(--gold-dim);
  border-radius: 6px;
}
.pool-note span {
  flex: 1;
}
.pool-toggle {
  font-family: 'Noto Serif TC', serif;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 5px;
  cursor: pointer;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
}
.pool-toggle:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  font-size: 16px;
  color: var(--ivory);
  background: var(--slot);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-sizing: border-box;
  font-family: 'Noto Serif TC', serif;
}
.search-input:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 2px rgba(217, 180, 73, 0.3);
}

/* 篩選列 */
.filter-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.type-select {
  flex: 1;
  height: 38px;
  padding: 0 10px;
  background: var(--slot);
  color: var(--ivory);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  cursor: pointer;
}
.type-select:focus {
  outline: none;
  border-color: var(--gold);
}
.sf-clear {
  margin-top: 4px;
  padding: 5px 14px;
  background: transparent;
  color: var(--ivory);
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: 'Noto Serif TC', serif;
  opacity: 0.75;
  transition: all 0.15s;
}
.sf-clear:hover {
  opacity: 1;
  border-color: var(--gold-dim);
}

/* 數值反查 */
.stats-filter {
  margin-top: 12px;
  padding: 12px;
  background: var(--slot);
  border: 1px solid var(--line);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.sf-hint {
  font-size: 12px;
  opacity: 0.7;
}
.sf-cross {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 6px;
  width: 150px;
}
.sf-t {
  grid-column: 2;
  grid-row: 1;
}
.sf-l {
  grid-column: 1;
  grid-row: 2;
}
.sf-center {
  grid-column: 2;
  grid-row: 2;
}
.sf-r {
  grid-column: 3;
  grid-row: 2;
}
.sf-b {
  grid-column: 2;
  grid-row: 3;
}
.sf-input {
  width: 100%;
  height: 38px;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  color: var(--ivory);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-sizing: border-box;
}
.sf-input:focus {
  outline: none;
  border-color: var(--gold);
}

.results {
  flex: 1;
  overflow-y: auto;
  margin: 12px 0;
  min-height: 120px;
  max-height: 320px;
}
.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--line);
  color: var(--ivory);
  cursor: pointer;
  text-align: left;
  font-family: 'Noto Serif TC', serif;
  transition: background 0.12s;
}
.result-row:hover {
  background: rgba(217, 180, 73, 0.1);
}
.r-no {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--gold);
  min-width: 54px;
}
.r-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--ivory);
  opacity: 0.45;
  min-width: 48px;
}
.r-name {
  flex: 1;
  font-size: 14px;
}
.r-stars {
  font-size: 11px;
  color: var(--gold);
}
.r-edges {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  opacity: 0.7;
  min-width: 64px;
  text-align: right;
}
.no-result {
  text-align: center;
  padding: 30px;
  opacity: 0.5;
}

.manual-toggle {
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ivory);
  padding: 8px;
  cursor: pointer;
  font-size: 13px;
  font-family: 'Noto Serif TC', serif;
}
.manual-toggle:hover {
  border-color: var(--gold-dim);
}

.manual {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.cross {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  width: 170px;
}
.pos-t {
  grid-column: 2;
  grid-row: 1;
}
.pos-l {
  grid-column: 1;
  grid-row: 2;
}
.cross-center {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--gold);
  opacity: 0.85;
}
.pos-r {
  grid-column: 3;
  grid-row: 2;
}
.pos-b {
  grid-column: 2;
  grid-row: 3;
}
.edge-input {
  width: 100%;
  height: 44px;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--ivory);
  background: var(--slot);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-sizing: border-box;
}
.edge-input:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 2px rgba(217, 180, 73, 0.3);
}

.picker-actions {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.btn {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 14px;
  letter-spacing: 1px;
  padding: 9px 22px;
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
.btn.primary:hover {
  box-shadow: 0 0 14px rgba(217, 180, 73, 0.5);
}
.btn.ghost {
  background: transparent;
  color: var(--ivory);
}
.btn.ghost:hover {
  border-color: var(--ivory);
  background: rgba(255, 255, 255, 0.05);
}

/* 手機：改成底部抽屜，清單佔滿剩餘高度 */
@media (max-width: 720px) {
  .picker-backdrop {
    align-items: flex-end;
  }
  .picker {
    width: 100%;
    max-width: 100%;
    max-height: 92dvh;
    padding: 16px 14px 20px;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
  }
  .picker-title {
    margin-bottom: 10px;
  }
  .results {
    max-height: none;
    flex: 1;
    min-height: 120px;
  }
  .result-row {
    padding: 10px 8px;
  }
  .r-id {
    display: none;
  }
}
</style>
