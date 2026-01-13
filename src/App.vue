<script setup lang="ts">
import { onMounted, ref } from "vue";
import AppAlert from "./components/AppAlert.vue";
import AppSidebar from "./components/AppSidebar.vue";
import PortsView from "./components/PortsView.vue";
import ProjectsView from "./components/ProjectsView.vue";
import { useLogLinkify } from "./composables/useLogLinkify";
import { usePorts } from "./composables/usePorts";
import { useProjects } from "./composables/useProjects";

type TabType = "projects" | "ports";

const activeTab = ref<TabType>("projects");

const {
  ports,
  isLoadingPorts,
  portError,
  refreshPorts,
  killPort,
} = usePorts();

const {
  projects,
  scanRoot,
  isScanning,
  selectedPath,
  errorMessage,
  searchQuery,
  isInstalling,
  showActiveOnly,
  filteredProjects,
  selectedProject,
  currentLogs,
  statusLabel,
  updateProject,
  pushLog,
  scanProjects,
  selectProject,
  toggleProject,
  clearLogs,
  installDependencies,
  toggleActiveOnly,
  openProjectFolder,
} = useProjects({ onPortsRefresh: refreshPorts });

const { currentLogsHtml, handleLogClick } = useLogLinkify(currentLogs);

onMounted(async () => {
  scanRoot.value = await window.api.getDefaultRoot();
  await scanProjects();
  await refreshPorts();

  window.api.onProcessOutput((payload) => pushLog(payload.path, payload.data));
  window.api.onProcessExit((payload) => {
    updateProject(payload.path, {
      status: "stopped",
      exitCode: payload.code ?? null,
      command: payload.command,
    });
  });
});

async function selectScanRoot() {
  const selected = await window.api.selectFolder();
  if (selected) {
    scanRoot.value = selected;
    await scanProjects();
  }
}

async function resetScanRoot() {
  scanRoot.value = await window.api.getDefaultRoot();
  await scanProjects();
}
</script>

<template>
  <div class="app">
    <AppSidebar
      v-model:activeTab="activeTab"
      v-model:scanRoot="scanRoot"
      :projects-count="projects.length"
      :ports-count="ports.length"
      :is-scanning="isScanning"
      @scan="scanProjects"
      @select-scan-root="selectScanRoot"
      @reset-scan-root="resetScanRoot"
    />

    <main class="main-content">
      <AppAlert :message="errorMessage" />

      <ProjectsView
        v-if="activeTab === 'projects'"
        v-model:searchQuery="searchQuery"
        :projects="projects"
        :filtered-projects="filteredProjects"
        :selected-path="selectedPath"
        :selected-project="selectedProject"
        :is-installing="isInstalling"
        :show-active-only="showActiveOnly"
        :current-logs-html="currentLogsHtml"
        :status-label="statusLabel"
        @select-project="selectProject"
        @toggle-project="toggleProject"
        @toggle-active-only="toggleActiveOnly"
        @clear-logs="clearLogs"
        @install="installDependencies"
        @open-folder="openProjectFolder"
        @log-click="handleLogClick"
      />

      <PortsView
        v-if="activeTab === 'ports'"
        :ports="ports"
        :is-loading-ports="isLoadingPorts"
        :port-error="portError"
        @refresh-ports="refreshPorts"
        @kill-port="killPort"
      />
    </main>
  </div>
</template>
