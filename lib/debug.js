export function createDebugLogger(enabled, namespace = "") {
  const label = namespace ? `[debug:${namespace}]` : "[debug]";
  return {
    log: (...args) => {
      if (!enabled) return;
      console.log(label, ...args);
    }
  };
}
