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
  filteredProjects,
  selectedProject,
  currentLogs,
  selectedCommand,
  statusLabel,
  updateProject,
  pushLog,
  scanProjects,
  selectProject,
  toggleProject,
  clearLogs,
  installDependencies,
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
        :selected-command="selectedCommand"
        :is-installing="isInstalling"
        :current-logs-html="currentLogsHtml"
        :status-label="statusLabel"
        @select-project="selectProject"
        @toggle-project="toggleProject"
        @clear-logs="clearLogs"
        @install="installDependencies"
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
