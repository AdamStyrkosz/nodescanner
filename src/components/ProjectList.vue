<script setup lang="ts">
defineProps<{
  projects: ProjectInfo[];
  filteredProjects: ProjectInfo[];
  selectedPath: string | null;
  searchQuery: string;
  showActiveOnly: boolean;
  statusLabel: (status: ProjectInfo["status"]) => string;
}>();

defineEmits<{
  (event: "update:searchQuery", value: string): void;
  (event: "selectProject", value: string): void;
  (event: "toggleProject", value: ProjectInfo): void;
  (event: "toggleActiveOnly"): void;
}>();

function getFolderName(projectPath: string) {
  const trimmed = projectPath.replace(/[\\/]+$/, "");
  if (!trimmed) return projectPath;
  const normalized = trimmed.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? projectPath;
}
</script>

<template>
  <div class="project-list-container">
    <div class="project-search">
      <div class="search-row">
        <div class="search-wrapper">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="search-icon"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            :value="searchQuery"
            type="text"
            placeholder="Search projects..."
            class="search-input"
            @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="searchQuery"
            class="clear-btn"
            title="Clear"
            @click="$emit('update:searchQuery', '')"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <button
          class="filter-btn"
          :class="{ active: showActiveOnly }"
          title="Show active only"
          @click="$emit('toggleActiveOnly')"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </button>
      </div>
    </div>
    <div class="project-list-header">
      <template v-if="searchQuery"> Found {{ filteredProjects.length }} projects </template>
      <template v-else> {{ projects.length }} projects </template>
    </div>
    <ul v-if="filteredProjects.length" class="project-list">
      <li
        v-for="project in filteredProjects"
        :key="project.path"
        class="project-item"
        :class="{ active: project.path === selectedPath }"
        @click="$emit('selectProject', project.path)"
      >
        <div class="project-status-dot" :class="project.status"></div>
        <div class="project-info">
          <div class="project-name">{{ project.name }}</div>
          <div class="project-path" :title="project.path">
            {{ getFolderName(project.path) }}
          </div>
          <div class="project-meta">
            <span class="status-badge" :class="project.status">
              {{ statusLabel(project.status) }}
            </span>
          </div>
        </div>
        <div class="project-actions">
          <button
            class="small"
            :disabled="!project.hasDev && !project.hasStart"
            @click.stop="$emit('toggleProject', project)"
          >
            {{ project.status === "running" ? "Stop" : "Start" }}
          </button>
        </div>
      </li>
    </ul>
    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 3h18v18H3zM21 9H3M9 21V9" />
      </svg>
      {{ searchQuery ? "No projects found" : "No projects" }}
    </div>
  </div>
</template>
