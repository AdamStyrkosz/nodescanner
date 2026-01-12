import { computed, ref } from "vue";

type UseProjectsOptions = {
  onPortsRefresh?: () => void | Promise<void>;
};

export function useProjects(options: UseProjectsOptions = {}) {
  const api = window.api as typeof window.api & {
    install: (projectPath: string) => Promise<InstallResponse>;
  };

  const projects = ref<ProjectInfo[]>([]);
  const logs = ref<Record<string, string[]>>({});
  const scanRoot = ref("");
  const isScanning = ref(false);
  const selectedPath = ref<string | null>(null);
  const errorMessage = ref("");
  const searchQuery = ref("");
  const isInstalling = ref(false);

  const filteredProjects = computed(() => {
    if (!searchQuery.value) return projects.value;
    const query = searchQuery.value.toLowerCase();
    return projects.value.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query)
    );
  });

  const selectedProject = computed(
    () => projects.value.find((project) => project.path === selectedPath.value) ?? null
  );

  const currentLogs = computed(() => {
    if (!selectedPath.value) return "";
    return (logs.value[selectedPath.value] ?? []).join("");
  });

  const selectedCommand = computed(() => {
    if (!selectedProject.value) return "-";
    return selectedProject.value.command ?? scriptLabel(selectedProject.value);
  });

  function statusLabel(status: ProjectInfo["status"]) {
    switch (status) {
      case "running":
        return "Running";
      case "error":
        return "Error";
      default:
        return "Stopped";
    }
  }

  function scriptLabel(project: ProjectInfo) {
    if (project.hasDev) return "npm run dev";
    if (project.hasStart) return "npm start";
    return "none";
  }

  function updateProject(path: string, updates: Partial<ProjectInfo>) {
    const index = projects.value.findIndex((project) => project.path === path);
    if (index !== -1) {
      projects.value[index] = { ...projects.value[index], ...updates };
    }
  }

  function pushLog(path: string, message: string) {
    const entries = logs.value[path] ?? [];
    entries.push(message);
    if (entries.length > 2000) entries.splice(0, entries.length - 2000);
    logs.value[path] = entries;
  }

  async function refreshPorts() {
    await options.onPortsRefresh?.();
  }

  async function scanProjects() {
    isScanning.value = true;
    errorMessage.value = "";
    try {
      const result = await api.scanProjects(scanRoot.value);
      projects.value = result;
      if (!selectedPath.value && result.length > 0) {
        selectedPath.value = result[0].path;
      }
    } catch {
      errorMessage.value = "Failed to scan disk.";
    } finally {
      isScanning.value = false;
    }
  }

  async function selectProject(path: string) {
    selectedPath.value = path;
    if (!logs.value[path]) {
      logs.value[path] = await api.getLogs(path);
    }
  }

  async function toggleProject(project: ProjectInfo) {
    errorMessage.value = "";
    if (!project.hasDev && !project.hasStart) {
      errorMessage.value = `Project ${project.name} doesn't have a dev or start script.`;
      return;
    }

    if (project.status === "running") {
      await api.stopProject(project.path);
      updateProject(project.path, { status: "stopped" });
      await refreshPorts();
      return;
    }

    const result = await api.startProject(project.path);
    if (result.status === "error") {
      updateProject(project.path, { status: "error" });
      errorMessage.value = result.message ?? "Failed to start project.";
      return;
    }

    updateProject(project.path, {
      status: "running",
      command: result.command,
      exitCode: null,
    });
    selectedPath.value = project.path;
    logs.value[project.path] = await api.getLogs(project.path);
    await refreshPorts();
  }

  function clearLogs() {
    if (selectedPath.value) {
      logs.value[selectedPath.value] = [];
    }
  }

  async function installDependencies() {
    if (!selectedPath.value || isInstalling.value) return;

    isInstalling.value = true;
    errorMessage.value = "";

    try {
      const result = await api.install(selectedPath.value);
      if (result.status === "error") {
        errorMessage.value = result.message ?? "Failed to run npm install.";
      }
    } catch {
      errorMessage.value = "An error occurred while trying to run npm install.";
    } finally {
      isInstalling.value = false;
    }
  }

  return {
    projects,
    logs,
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
  };
}
