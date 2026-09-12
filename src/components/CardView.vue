<script setup lang="ts">
// ============================================================
// CardView.vue — 單張卡牌（展示型元件）
// 只負責顯示傳入的卡，不持有任何業務狀態。
// 手牌與棋盤上的卡都用它，靠 props 控制外觀與狀態。
// ============================================================
import { computed } from 'vue'
import type { Card, Edges, Player } from '../engine/types'

interface Props {
  card: Card // 要顯示的卡
  owner: Player // 歸屬（決定紅/藍配色）
  size?: 'mini' | 'placed' // mini=手牌尺寸，placed=棋盤滿格
  selected?: boolean // 是否被選取（金邊高亮）
  dim?: boolean // 是否變暗（非當前回合方）
  clickable?: boolean // 是否可點
  editable?: boolean // 是否顯示編輯鈕（手動輸入用）
  editing?: boolean // 是否正在被編輯（編輯面板開著時高亮）
  displayEdges?: Edges // 顯示用四邊值（強化/弱化加成後）；不傳則用原始值
}

const props = withDefaults(defineProps<Props>(), {
  size: 'mini',
  selected: false,
  dim: false,
  clickable: false,
  editable: false,
  editing: false,
})

// 實際顯示的四邊值：優先用加成後的 displayEdges，否則原始 edges。
const shownEdges = computed(() => props.displayEdges ?? props.card.edges)
// 某一邊是否被加成改變了（用來標色提示）。
function boosted(dir: keyof Edges): boolean {
  return !!props.displayEdges && props.displayEdges[dir] !== props.card.edges[dir]
}

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'edit'): void
}>()

function onClick() {
  if (props.clickable) emit('select')
}

function onEdit(ev: Event) {
  // 擋掉冒泡，避免點編輯鈕同時觸發卡片選取。
  ev.stopPropagation()
  emit('edit')
}
</script>

<template>
  <button
    class="card"
    :class="[
      owner === 'RED' ? 'red' : 'blue',
      size,
      { selected, dim, clickable, editing, unknown: card.unknown },
    ]"
    @click="onClick"
  >
    <!-- 未知卡：顯示問號，不顯示數值 -->
    <template v-if="card.unknown">
      <span class="unknown-mark">?</span>
    </template>
    <!-- 已知卡：顯示四邊數值與名稱（強化/弱化時顯示加成後的值）-->
    <template v-else>
      <span class="cn cn-t" :class="{ boost: boosted('top') }">{{ shownEdges.top }}</span>
      <span class="cn cn-r" :class="{ boost: boosted('right') }">{{ shownEdges.right }}</span>
      <span class="cn cn-b" :class="{ boost: boosted('bottom') }">{{ shownEdges.bottom }}</span>
      <span class="cn cn-l" :class="{ boost: boosted('left') }">{{ shownEdges.left }}</span>
      <span class="card-name">{{ card.nameZh ?? card.name }}</span>
    </template>
    <span v-if="editable" class="edit-btn" role="button" aria-label="編輯數值" @click="onEdit"
      >✎</span
    >
  </button>
</template>

<style scoped>
.card {
  position: relative;
  border: 2px solid;
  border-radius: 8px;
  cursor: default;
  padding: 0;
  transition:
    transform 0.12s,
    box-shadow 0.12s,
    border-color 0.12s;
}
.card.clickable {
  cursor: pointer;
}
.card.red {
  background: linear-gradient(158deg, var(--red) 0%, var(--red-deep) 100%);
  border-color: #d96b60;
}
.card.blue {
  background: linear-gradient(158deg, var(--blue) 0%, var(--blue-deep) 100%);
  border-color: #6ba0c8;
}
.card.mini {
  width: 76px;
  height: 96px;
}
.card.placed {
  width: 100%;
  height: 100%;
  border-radius: 7px;
  animation: drop 0.22s ease-out;
}
@keyframes drop {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.card-name {
  position: absolute;
  bottom: 5px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: -0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  /* 中文名最長可到 14 字，mini 卡只有 76px 寬，超出就截斷不撐破卡面 */
  padding: 0 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card.placed .card-name {
  font-size: 12px;
}

.cn {
  position: absolute;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  text-shadow:
    0 0 3px rgba(0, 0, 0, 0.6),
    0 1px 2px rgba(0, 0, 0, 0.8);
}
.card.placed .cn {
  font-size: 19px;
}
/* 被強化/弱化改變的數值：金色 + 微光，一眼可辨 */
.cn.boost {
  color: var(--gold);
  text-shadow:
    0 0 4px rgba(217, 180, 73, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.8);
}
.cn-t {
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
}
.cn-b {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
}
.card.placed .cn-b {
  bottom: 22px;
}
.cn-l {
  left: 7px;
  top: 40%;
}
.cn-r {
  right: 7px;
  top: 40%;
}

@media (hover: hover) {
  .card.mini.clickable:hover:not(.dim) {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }
}
.card.mini.selected {
  border-color: var(--gold);
  box-shadow:
    0 0 0 2px var(--gold),
    0 0 18px rgba(217, 180, 73, 0.6);
  transform: translateY(-3px);
}
.card.mini.dim {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 未知卡：暗色卡面、大問號 */
.card.unknown {
  background: linear-gradient(158deg, #4a4a52 0%, #34343a 100%);
  border-color: #5a5a62;
}
.unknown-mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'Cinzel', serif;
}
.card.placed.unknown .unknown-mark {
  font-size: 40px;
}

/* 正在編輯：脈動金框，明確標示當前編輯的是哪張 */
.card.editing {
  border-color: var(--gold) !important;
  box-shadow:
    0 0 0 3px var(--gold),
    0 0 20px rgba(217, 180, 73, 0.7);
  animation: editPulse 1.4s ease-in-out infinite;
  z-index: 3;
}
@keyframes editPulse {
  0%,
  100% {
    box-shadow:
      0 0 0 3px var(--gold),
      0 0 16px rgba(217, 180, 73, 0.6);
  }
  50% {
    box-shadow:
      0 0 0 3px var(--gold),
      0 0 28px rgba(217, 180, 73, 0.9);
  }
}
@media (prefers-reduced-motion: reduce) {
  .card.editing {
    animation: none;
  }
}

/* 編輯鈕：右上角小圓鈕 */
.edit-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: var(--gold);
  color: #1a1408;
  border: 1px solid #1a1408;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition:
    transform 0.12s,
    box-shadow 0.12s;
  z-index: 5;
}
@media (hover: hover) {
  .edit-btn:hover {
    transform: scale(1.15);
    box-shadow: 0 0 10px rgba(217, 180, 73, 0.7);
  }
}

/* 手機：mini 卡跟隨欄寬；編輯鈕放大到手指點得到 */
@media (max-width: 720px) {
  .card.mini {
    width: 100%;
    height: auto;
    aspect-ratio: 76 / 96;
  }
  .card.mini .cn {
    font-size: 15px;
  }
  .card.mini .cn-l {
    left: 5px;
  }
  .card.mini .cn-r {
    right: 5px;
  }
}
@media (pointer: coarse) {
  .edit-btn {
    width: 28px;
    height: 28px;
    font-size: 15px;
    top: -10px;
    right: -10px;
  }
}
</style>
