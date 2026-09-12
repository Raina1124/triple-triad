<script setup lang="ts">
// ============================================================
// HandPanel.vue — 一方的手牌區（展示型元件）
// 標籤 + 計分 + 固定 5 格（已出的格顯示灰框佔位，維持位置不變）。
// ============================================================
import type { Card, Edges, Player } from '../engine/types'
import CardView from './CardView.vue'

interface HandSlot {
  card: Card | null // 未出時的當前卡；已出為 null
  played: boolean // 是否已出掉
}

interface Props {
  player: Player // 這是哪一方
  slots: HandSlot[] // 固定 5 格（含已出標記）
  score: number // 該方目前分數
  selectedCardId: number | null // 目前選取的卡 id
  isActive: boolean // 是否輪到這方（決定可點/變暗）
  editable: boolean // 是否可編輯數值
  editingCardId?: number | null // 正在被編輯的卡 id（高亮用）
  swapMode?: boolean // 交換模式：雙方手牌都可點
  swapFirstId?: number | null // 交換已選的第一張（高亮）
  displayEdgesFor?: (card: Card) => Edges // 算顯示用四邊（強化/弱化加成）
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', cardId: number): void
  (e: 'edit', cardId: number): void
}>()

const label = props.player === 'RED' ? '紅方' : '藍方'
</script>

<template>
  <div class="hand-group">
    <div class="hand-label" :class="player === 'RED' ? 'red' : 'blue'">
      {{ label }}<span class="count">{{ score }}</span>
    </div>
    <div class="hand-cards">
      <template v-for="(slot, i) in slots" :key="i">
        <!-- 未出：正常卡 -->
        <CardView
          v-if="!slot.played && slot.card"
          :card="slot.card"
          :owner="player"
          size="mini"
          :selected="selectedCardId === slot.card.id || swapFirstId === slot.card.id"
          :dim="!isActive && !swapMode"
          :clickable="isActive || swapMode"
          :editable="editable"
          :editing="editingCardId === slot.card.id"
          :display-edges="displayEdgesFor ? displayEdgesFor(slot.card) : undefined"
          @select="emit('select', slot.card!.id)"
          @edit="emit('edit', slot.card!.id)"
        />
        <!-- 已出：灰框佔位 -->
        <div v-else class="played-slot"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hand-label {
  font-family: 'Cinzel', serif;
  font-size: 15px;
  letter-spacing: 2px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.hand-label .count {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  background: rgba(0, 0, 0, 0.25);
  padding: 1px 10px;
  border-radius: 6px;
}
.hand-label.red {
  color: #e08b82;
}
.hand-label.blue {
  color: #8fb8da;
}
.hand-cards {
  display: grid;
  grid-template-columns: repeat(3, 76px);
  gap: 8px;
  justify-content: center;
}

/* 已出掉的格子：灰框佔位 */
.played-slot {
  width: 76px;
  height: 96px;
  border: 1px dashed var(--line);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.15);
  opacity: 0.5;
}

/* 手機：5 張橫排，卡寬跟隨欄寬 */
@media (max-width: 720px) {
  .hand-label {
    margin-bottom: 6px;
  }
  .hand-cards {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }
  .played-slot {
    width: auto;
    height: auto;
    aspect-ratio: 76 / 96;
  }
}
</style>
