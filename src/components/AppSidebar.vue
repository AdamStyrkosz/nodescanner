<script setup lang="ts">
type TabType = "projects" | "ports";

defineProps<{
  activeTab: TabType;
  projectsCount: number;
  portsCount: number;
  scanRoot: string;
  isScanning: boolean;
}>();

defineEmits<{
  (event: "update:activeTab", value: TabType): void;
  (event: "update:scanRoot", value: string): void;
  (event: "scan"): void;
}>();
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="app-title">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        NodeScanner
      </div>
    </div>

    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ active: activeTab === 'projects' }"
        @click="$emit('update:activeTab', 'projects')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 3h18v18H3zM21 9H3M9 21V9" />
        </svg>
        Projects
        <span class="nav-badge">{{ projectsCount }}</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeTab === 'ports' }"
        @click="$emit('update:activeTab', 'ports')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01M10 8h.01" />
        </svg>
        Ports
        <span class="nav-badge">{{ portsCount }}</span>
      </button>
    </nav>

    <div class="sidebar-scan">
      <div class="scan-label">Scan path</div>
      <div class="scan-input-wrapper">
        <div class="scan-input-row">
          <input
            :value="scanRoot"
            type="text"
            placeholder="/"
            @input="$emit('update:scanRoot', ($event.target as HTMLInputElement).value)"
          />
          <button class="scan-folder-btn" type="button" title="Select folder">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
              />
            </svg>
          </button>
        </div>
        <button class="primary scan-btn" :disabled="isScanning" @click="$emit('scan')">
          <svg
            v-if="isScanning"
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
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {{ isScanning ? "Scanning..." : "Scan disk" }}
        </button>
      </div>
    </div>
  </aside>
</template>
