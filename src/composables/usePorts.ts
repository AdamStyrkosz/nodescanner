import { ref } from "vue";

export function usePorts() {
  const ports = ref<PortInfo[]>([]);
  const isLoadingPorts = ref(false);
  const portError = ref("");

  async function refreshPorts() {
    isLoadingPorts.value = true;
    portError.value = "";
    try {
      ports.value = await window.api.listPorts();
    } catch {
      portError.value = "Failed to read ports.";
    } finally {
      isLoadingPorts.value = false;
    }
  }

  async function killPort(port: PortInfo) {
    portError.value = "";
    const result = await window.api.killPort(port.pid);
    if (result.status === "error") {
      portError.value = result.message ?? "Failed to terminate process.";
      return;
    }
    await refreshPorts();
  }

  return {
    ports,
    isLoadingPorts,
    portError,
    refreshPorts,
    killPort,
  };
}
