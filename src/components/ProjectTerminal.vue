<script setup lang="ts">
defineProps<{
  selectedProject: ProjectInfo | null;
  selectedPath: string | null;
  isInstalling: boolean;
  currentLogsHtml: string;
}>();

defineEmits<{
  (event: "clearLogs"): void;
  (event: "install"): void;
  (event: "openFolder"): void;
  (event: "logClick", payload: MouseEvent): void;
}>();
</script>

<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <div class="terminal-info">
        <div class="terminal-info-item">
          <span class="terminal-info-label">Project</span>
          <span class="terminal-info-value">{{ selectedProject?.name ?? "-" }}</span>
        </div>
      </div>
      <div class="terminal-actions">
        <button
          class="small"
          :disabled="!selectedPath || isInstalling || selectedProject?.status === 'running'"
          @click="$emit('install')"
        >
          <svg
            v-if="isInstalling"
            class="spin"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          {{ isInstalling ? "Installing..." : "npm install" }}
        </button>
        <button class="small" :disabled="!selectedPath" @click="$emit('openFolder')">
          Open folder
        </button>
        <button class="small" :disabled="!selectedPath" @click="$emit('clearLogs')">
          Clear
        </button>
      </div>
    </div>
    <pre
      class="terminal-output"
      v-html="currentLogsHtml"
      @click="$emit('logClick', $event)"
    ></pre>
  </div>
</template>
