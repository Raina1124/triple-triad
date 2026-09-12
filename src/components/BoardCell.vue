<script setup lang="ts">
// ============================================================
// BoardCell.vue — 棋盤單格（展示型元件）
// 空格 or 放了卡；含「可落子」與「建議高亮」狀態。
// ============================================================
import type { Cell, Edges } from '../engine/types'
import CardView from './CardView.vue'

interface Props {
  cell: Cell // 格子內容（card 為 null 表示空格）
  suggested: boolean // 是否為建議最佳手的格子（金色聚光）
  placeable: boolean // 是否可落子（已選卡且此格為空）
  editing?: boolean // 此格的卡是否正在被編輯（高亮用）
  picked?: boolean // 調換位置模式下，此格是已選的第一格
  displayEdges?: Edges // 顯示用四邊（強化/弱化加成後）
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'place'): void
  (e: 'edit'): void
}>()
</script>

<template>
  <button class="slot" :class="{ suggested, placeable, picked }" @click="emit('place')">
    <CardView
      v-if="cell.card"
      :card="cell.card"
      :owner="cell.owner ?? 'RED'"
      size="placed"
      :editable="true"
      :editing="editing"
      :display-edges="displayEdges"
      @edit="emit('edit')"
    />
  </button>
</template>

<style scoped>
.slot {
  width: clamp(96px, 13vw, 130px);
  height: clamp(120px, 16vw, 162px);
  background: var(--slot);
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: default;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.slot.placeable {
  cursor: pointer;
  border-color: var(--gold-dim);
  background: rgba(217, 180, 73, 0.06);
}
.slot.placeable:hover {
  border-color: var(--gold);
  box-shadow: inset 0 0 12px rgba(217, 180, 73, 0.2);
}

/* 調換位置模式：已選的第一格。用虛線金框，與建議最佳手的金色聚光區隔 */
.slot.picked {
  border: 2px dashed var(--gold);
  background: rgba(217, 180, 73, 0.1);
}

/* 簽名元素：建議最佳手的金色聚光標記 */
.slot.suggested {
  border: 2px solid var(--gold);
  box-shadow:
    0 0 0 2px rgba(217, 180, 73, 0.3),
    0 0 24px rgba(217, 180, 73, 0.55),
    inset 0 0 18px rgba(217, 180, 73, 0.25);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(217, 180, 73, 0.3),
      0 0 18px rgba(217, 180, 73, 0.4),
      inset 0 0 14px rgba(217, 180, 73, 0.2);
  }
  50% {
    box-shadow:
      0 0 0 3px rgba(217, 180, 73, 0.5),
      0 0 32px rgba(217, 180, 73, 0.7),
      inset 0 0 22px rgba(217, 180, 73, 0.35);
  }
}

/* 手機：格子跟隨棋盤欄寬，避免 360px 機型溢出 */
@media (max-width: 720px) {
  .slot {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
  }
}
/* 觸控沒有 hover，可落子的提示要在靜態就看得見 */
@media (pointer: coarse) {
  .slot.placeable {
    border-color: var(--gold);
    box-shadow: inset 0 0 12px rgba(217, 180, 73, 0.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slot.suggested {
    animation: none;
  }
}
</style>
