<script setup lang="ts">
defineProps<{
  selectedProject: ProjectInfo | null;
  selectedCommand: string;
  selectedPath: string | null;
  isInstalling: boolean;
  currentLogsHtml: string;
}>();

defineEmits<{
  (event: "clearLogs"): void;
  (event: "install"): void;
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
        <div class="terminal-info-item">
          <span class="terminal-info-label">Command</span>
          <span class="terminal-info-value mono">{{ selectedCommand }}</span>
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
