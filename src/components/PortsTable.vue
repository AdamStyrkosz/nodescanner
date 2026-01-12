<script setup lang="ts">
defineProps<{ ports: PortInfo[] }>();

defineEmits<{
  (event: "killPort", port: PortInfo): void;
}>();
</script>

<template>
  <div class="ports-table">
    <table>
      <thead>
        <tr>
          <th>Port</th>
          <th>PID</th>
          <th>Command</th>
          <th>Address</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="port in ports" :key="`${port.pid}-${port.port}`">
          <td class="port-number">:{{ port.port }}</td>
          <td class="port-pid">{{ port.pid }}</td>
          <td class="port-command">{{ port.command }}</td>
          <td class="port-address">{{ port.address }}</td>
          <td>
            <button class="danger small" @click="$emit('killPort', port)">Kill</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
