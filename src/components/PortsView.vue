<script setup lang="ts">
import AppAlert from "./AppAlert.vue";
import PortsTable from "./PortsTable.vue";

defineProps<{
  ports: PortInfo[];
  isLoadingPorts: boolean;
  portError: string;
}>();

defineEmits<{
  (event: "refreshPorts"): void;
  (event: "killPort", port: PortInfo): void;
}>();
</script>

<template>
  <div class="content-area">
    <div class="ports-view">
      <div class="toolbar">
        <span class="toolbar-title">Occupied ports</span>
        <div class="toolbar-actions">
          <button :disabled="isLoadingPorts" @click="$emit('refreshPorts')">
            <svg
              v-if="isLoadingPorts"
              class="spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            <template v-else>Refresh</template>
          </button>
        </div>
      </div>
      <AppAlert :message="portError" />
      <PortsTable v-if="ports.length" :ports="ports" @kill-port="$emit('killPort', $event)" />
      <div v-else class="empty-state">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01M10 8h.01" />
        </svg>
        No occupied ports
      </div>
    </div>
  </div>
</template>
