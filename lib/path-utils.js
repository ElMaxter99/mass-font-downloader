import path from "node:path";

export function resolveSafePath(baseDir, ...segments) {
  const resolvedBase = path.resolve(baseDir);
  const targetPath = path.resolve(resolvedBase, ...segments);

  if (targetPath === resolvedBase || targetPath.startsWith(`${resolvedBase}${path.sep}`)) {
    return targetPath;
  }

  throw new Error(
    `Se detectó un intento de path traversal al resolver la ruta: ${segments.join(path.sep)}`
  );
}
