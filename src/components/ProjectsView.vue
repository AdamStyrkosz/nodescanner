<script setup lang="ts">
import ProjectList from "./ProjectList.vue";
import ProjectTerminal from "./ProjectTerminal.vue";

defineProps<{
  projects: ProjectInfo[];
  filteredProjects: ProjectInfo[];
  selectedPath: string | null;
  selectedProject: ProjectInfo | null;
  searchQuery: string;
  isInstalling: boolean;
  showActiveOnly: boolean;
  currentLogsHtml: string;
  statusLabel: (status: ProjectInfo["status"]) => string;
}>();

defineEmits<{
  (event: "update:searchQuery", value: string): void;
  (event: "selectProject", value: string): void;
  (event: "toggleProject", value: ProjectInfo): void;
  (event: "toggleActiveOnly"): void;
  (event: "clearLogs"): void;
  (event: "install"): void;
  (event: "openFolder"): void;
  (event: "logClick", payload: MouseEvent): void;
}>();
</script>

<template>
  <div class="content-area">
    <div class="projects-view">
      <ProjectList
        :search-query="searchQuery"
        :projects="projects"
        :filtered-projects="filteredProjects"
        :selected-path="selectedPath"
        :show-active-only="showActiveOnly"
        :status-label="statusLabel"
        @update:searchQuery="$emit('update:searchQuery', $event)"
        @select-project="$emit('selectProject', $event)"
        @toggle-project="$emit('toggleProject', $event)"
        @toggle-active-only="$emit('toggleActiveOnly')"
      />
      <ProjectTerminal
        :selected-project="selectedProject"
        :selected-path="selectedPath"
        :is-installing="isInstalling"
        :current-logs-html="currentLogsHtml"
        @clear-logs="$emit('clearLogs')"
        @install="$emit('install')"
        @open-folder="$emit('openFolder')"
        @log-click="$emit('logClick', $event)"
      />
    </div>
  </div>
</template>
