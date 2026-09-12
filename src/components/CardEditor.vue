<script setup lang="ts">
// ============================================================
// CardEditor.vue — 卡牌數值編輯面板（彈窗）
// 只編輯四邊數值（上右下左），範圍 1~10（10 即 A）。
// 設計：輸入框自由輸入，套用時才夾值到 1~10，避免打字中被打斷。
// ============================================================
import { ref, watch } from 'vue'
import type { Card, EdgeValue } from '../engine/types'

interface Props {
  card: Card
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (
    e: 'apply',
    edges: { top: EdgeValue; right: EdgeValue; bottom: EdgeValue; left: EdgeValue },
  ): void
  (e: 'cancel'): void
}>()

// 本地暫存（用字串，允許輸入過程中暫時為空或非法，套用時才驗證）。
const top = ref<string>(String(props.card.edges.top))
const right = ref<string>(String(props.card.edges.right))
const bottom = ref<string>(String(props.card.edges.bottom))
const left = ref<string>(String(props.card.edges.left))

// 換了要編輯的卡時，同步本地值。
watch(
  () => props.card,
  (c) => {
    top.value = String(c.edges.top)
    right.value = String(c.edges.right)
    bottom.value = String(c.edges.bottom)
    left.value = String(c.edges.left)
  },
)

// 即時範圍修正：超過 10 夾成 10，小於 1（含 0、負數）夾成 1，立刻反映。
// 允許單獨一個 "-" 或空字串等「輸入中」的中間狀態暫存（視為 NaN，不修正），
// 這樣打字不會被打斷。用 watch 而非 @input，避免反綁造成的更新迴圈。
function clampLive(s: string): string {
  if (s === '' || s === '-') return s // 輸入中的中間狀態，先放行
  const n = Number(s)
  if (isNaN(n)) return s
  if (n > 10) return '10'
  if (n < 1) return '1' // 0、-1、-5… 一律夾成 1
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

// 套用時把字串夾成 1~10 的整數。
function clamp(s: string): EdgeValue {
  let n = Math.round(Number(s))
  if (isNaN(n)) n = 1
  if (n < 1) n = 1
  if (n > 10) n = 10
  return n as EdgeValue
}

function apply() {
  emit('apply', {
    top: clamp(top.value),
    right: clamp(right.value),
    bottom: clamp(bottom.value),
    left: clamp(left.value),
  })
}
</script>

<template>
  <div class="editor-backdrop" @click.self="emit('cancel')">
    <div class="editor">
      <div class="editor-title">編輯數值</div>

      <!-- 十字排列，對應卡牌四邊位置 -->
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

      <div class="hint">數值範圍 1～10（A 請填 10）</div>

      <div class="editor-actions">
        <button class="btn ghost" @click="emit('cancel')">取消</button>
        <button class="btn primary" @click="apply">套用</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.editor {
  background: var(--panel);
  border: 1px solid var(--gold-dim);
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  min-width: 240px;
}
.editor-title {
  font-family: 'Cinzel', 'Noto Serif TC', serif;
  font-size: 18px;
  letter-spacing: 2px;
  color: var(--gold);
  text-align: center;
  margin-bottom: 20px;
}

.cross {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  width: 180px;
  margin: 0 auto;
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
  font-size: 16px;
  font-weight: 700;
  color: var(--gold);
  opacity: 0.85;
  letter-spacing: 0.5px;
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
  height: 48px;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
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

.hint {
  text-align: center;
  font-size: 12px;
  color: var(--ivory);
  opacity: 0.55;
  margin-top: 14px;
}

.editor-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  justify-content: center;
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
</style>
