import { computed } from "vue";
import type { ComputedRef } from "vue";

const linkPattern = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/[\S]*)?/gi;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitLinkMatch(value: string) {
  const match = value.match(/[),.!?;:]+$/);
  const trailing = match?.[0] ?? "";
  const core = trailing ? value.slice(0, -trailing.length) : value;
  return { core, trailing };
}

function linkifyLogText(text: string) {
  const source = text || "// No logs";
  let result = "";
  let lastIndex = 0;

  for (const match of source.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    const raw = match[0];
    result += escapeHtml(source.slice(lastIndex, index));

    const { core, trailing } = splitLinkMatch(raw);
    if (!core) {
      result += escapeHtml(raw);
    } else {
      const href = core.startsWith("http") ? core : `http://${core}`;
      result += `<a href="${escapeHtml(href)}" data-log-link="true">${escapeHtml(core)}</a>${escapeHtml(trailing)}`;
    }

    lastIndex = index + raw.length;
  }

  result += escapeHtml(source.slice(lastIndex));
  return result;
}

export function useLogLinkify(logText: ComputedRef<string>) {
  const api = window.api as typeof window.api & {
    openExternal: (url: string) => Promise<void>;
  };
  const currentLogsHtml = computed(() => linkifyLogText(logText.value));

  function handleLogClick(event: MouseEvent) {
    const target = event.target as Node | null;
    const element = target instanceof Element ? target : target?.parentElement;
    const link = element?.closest('a[data-log-link="true"]');
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    event.stopPropagation();
    void api.openExternal(href);
  }

  return { currentLogsHtml, handleLogClick };
}
