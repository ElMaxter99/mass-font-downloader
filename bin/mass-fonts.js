#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "fs-extra";
import axios from "axios";
import { Command } from "commander";

import {
  FORMAT_ALIASES,
  FORMAT_EXTENSIONS,
  FALLBACK_FORMATS,
  normalizeFormats,
  selectAvailableFormats,
  buildFamilyQuery,
  extractSourcesFromCss,
  formatVariantSummary,
  buildFileName,
  slugifyFontFolder,
  resolveWeightValue,
  resolveWeightOverrides
} from "../lib/font-utils.js";
import { createDebugLogger } from "../lib/debug.js";
import { resolveSafePath } from "../lib/path-utils.js";

const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2";

const program = new Command();

program
  .name("mass-fonts")
  .description("Descarga masiva de fuentes desde Google Fonts (renombradas por tipografía y peso)")
  .option("-f, --fonts <fonts>", "Lista de fuentes y pesos (ej: 'Roboto:400,700;Poppins:400')")
  .option("-o, --output <dir>", "Carpeta de salida")
  .option("--ts <file>", "Ruta del archivo font-options.ts (opcional)")
  .option(
    "--subset <subset>",
    "Subconjuntos separados por coma (latin,latin-ext,...) para la descarga"
  )
  .option("--formats <formats>", "Lista separada por comas de formatos (woff2, woff, ttf)")
  .option(
    "--weights <weights>",
    "Sobrescribe los pesos para todas las familias (ej: 'regular,semibold,bold')"
  )
  .option(
    "--config <file>",
    "Ruta del archivo de configuración a reutilizar (por defecto busca config/fonts.config.js)"
  )
  .option("--all", "Descargar todas las variantes disponibles de cada familia")
  .option("--debug", "Muestra información detallada de depuración")
  .parse(process.argv);

const options = program.opts();

function parseSubsets(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : item))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseFontsInput(str, overrideWeights, forceAllVariants) {
  if (!str || typeof str !== "string") {
    return [];
  }

  return str
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [namePart, weightsPart] = entry.split(":");
      const name = namePart ? namePart.trim() : "";
      if (!name) {
        return null;
      }

      const trimmedWeights = weightsPart ? weightsPart.trim() : "";
      const entryRequestsAll = trimmedWeights
        ? ["*", "all"].includes(trimmedWeights.toLowerCase())
        : false;

      const includeAll = forceAllVariants || (!overrideWeights?.length && entryRequestsAll);

      let weights = [];
      if (includeAll) {
        weights = [];
      } else if (overrideWeights?.length) {
        weights = overrideWeights;
      } else if (trimmedWeights) {
        const parsed = trimmedWeights
          .split(",")
          .map((token) => resolveWeightValue(token.trim()))
          .filter((value) => Number.isFinite(value));
        weights = parsed.length ? [...new Set(parsed)] : [400];
      } else {
        weights = overrideWeights?.length ? overrideWeights : [400];
      }

      return {
        name,
        weights,
        includeAll,
        formats: null
      };
    })
    .filter(Boolean);
}

function shouldConfigFontDownloadAll(font, overrideWeights, forceAllVariants) {
  if (forceAllVariants) return true;
  if (overrideWeights?.length) return false;

  if (font?.downloadAllVariants || font?.all === true) {
    return true;
  }

  if (typeof font?.weights === "string") {
    const token = font.weights.trim().toLowerCase();
    if (token === "all" || token === "*") {
      return true;
    }
  }

  return false;
}

function normalizeConfigFonts(fonts, overrideWeights, forceAllVariants) {
  if (!Array.isArray(fonts)) {
    return [];
  }

  const normalized = [];

  for (const font of fonts) {
    const name = font?.name?.trim();
    if (!name) continue;

    const includeAll = shouldConfigFontDownloadAll(font, overrideWeights, forceAllVariants);

    let weights = [];
    if (includeAll) {
      weights = [];
    } else if (overrideWeights?.length) {
      weights = overrideWeights;
    } else {
      const raw = Array.isArray(font.weights)
        ? font.weights
        : typeof font.weights === "string"
          ? font.weights
              .split(",")
              .map((token) => token.trim())
              .filter(Boolean)
          : font?.weights
            ? [font.weights]
            : [];

      const parsed = raw
        .map((value) => resolveWeightValue(value))
        .filter((value) => Number.isFinite(value));

      weights = parsed.length ? [...new Set(parsed)] : [400];
    }

    normalized.push({
      name,
      weights,
      includeAll,
      formats: font?.formats ?? null
    });
  }

  return normalized;
}

async function loadConfigFile(configPath, { required = false } = {}) {
  const exists = await fs.pathExists(configPath);
  if (!exists) {
    if (required) {
      throw new Error(`No se encontró el archivo de configuración en ${configPath}`);
    }
    return null;
  }

  const module = await import(pathToFileURL(configPath).href);
  const config = module?.default ?? module;

  if (!config || typeof config !== "object") {
    throw new Error(`El archivo de configuración ${configPath} no exporta un objeto válido`);
  }

  return { config, path: configPath };
}

async function getFontCss(familyQuery, subsets) {
  const subsetParam = Array.isArray(subsets) && subsets.length
    ? `&subset=${subsets.join(",")}`
    : "";
  const url = `${GOOGLE_FONTS_API}?${familyQuery}${subsetParam}&display=swap`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return data;
}

async function downloadFonts(fonts, outputDir, subsets, tsFile, defaultFormats, debug, fileNameOptions) {
  const resolvedOutputDir = path.resolve(outputDir);
  await fs.ensureDir(resolvedOutputDir);
  const fontOptions = [];

  console.log("Descargando fuentes desde Google Fonts...\n");

  const metadataFetcher = () =>
    axios.get("https://fonts.google.com/metadata/fonts", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://fonts.google.com/",
        Origin: "https://fonts.google.com"
      },
      responseType: "text"
    });

  for (const font of fonts) {
    const { name, weights, includeAll, formats } = font;
    const { query, variants } = await buildFamilyQuery(name, weights, {
      includeAllVariants: includeAll,
      metadataFetcher
    });
    debug.log(`Consulta generada para ${name}: ${query}`);
    debug.log(
      `Variantes resueltas (${variants.length}): ${variants
        .map((variant) => `${variant.weight}${variant.italic ? "i" : ""}`)
        .join(", ")}`
    );
    const variantSummary = formatVariantSummary(variants);

    const css = await getFontCss(query, subsets);
    debug.log(`${name}: CSS recibido (${css.length} caracteres)`);
    const sources = extractSourcesFromCss(css);
    debug.log(
      `${name}: Fuentes detectadas (${sources.length}): ${sources
        .map((source) => `${source.format}:${source.weight}${source.italic ? "i" : ""}`)
        .join(", ")}`
    );
    if (!sources.length) {
      console.warn(`No se encontraron URLs para ${name}`);
      continue;
    }

    const folder = slugifyFontFolder(name);
    const fontDir = resolveSafePath(resolvedOutputDir, folder);
    await fs.ensureDir(fontDir);

    const preparedSources = sources.map((source) => {
      const canonicalFormat = FORMAT_ALIASES[source.format];
      const extension = canonicalFormat ? FORMAT_EXTENSIONS[canonicalFormat] ?? canonicalFormat : null;
      return { ...source, canonicalFormat, extension };
    });

    const availableFormats = preparedSources
      .map((source) => source.canonicalFormat)
      .filter(Boolean);

    const requestedFormats = normalizeFormats(formats, defaultFormats);
    const effectiveFormats = selectAvailableFormats(requestedFormats, availableFormats);

    if (!effectiveFormats.length) {
      console.warn(
        `${name}: no se encontraron fuentes compatibles con los formatos solicitados (${requestedFormats.join(", ")}).`
      );
      continue;
    }

    const missingRequested = requestedFormats.filter((format) => !effectiveFormats.includes(format));
    if (missingRequested.length) {
      const fallbackMessage = `${name}: formatos no disponibles (${missingRequested.join(", ")}). Se usarán: ${effectiveFormats.join(", ")}`;
      console.warn(fallbackMessage);
      debug.log(fallbackMessage);
    }

    const displayFormats = effectiveFormats
      .map((format) => FORMAT_EXTENSIONS[format] ?? format)
      .join(", ");
    console.log(
      `→ ${name} (${includeAll ? `todas las variantes${variantSummary ? `: ${variantSummary}` : ""}` : weights.join(", ")}) → formatos: ${displayFormats}`
    );

    const matchedSources = preparedSources.filter((source) => {
      if (!source.canonicalFormat) {
        debug.log(
          `${name}: se descarta URL por formato desconocido (${source.format}) → ${source.url}`
        );
        return false;
      }
      if (!effectiveFormats.includes(source.canonicalFormat)) {
        debug.log(
          `${name}: se descarta URL por no coincidir con los formatos solicitados (${source.canonicalFormat}) → ${source.url}`
        );
        return false;
      }
      return true;
    });

    debug.log(`${name}: Fuentes tras filtrar formatos (${matchedSources.length})`);

    const fileNames = [];

    for (const source of matchedSources) {
      const fileName = buildFileName(
        folder,
        source.weight,
        source.italic,
        source.extension,
        fileNameOptions
      );
      const filePath = resolveSafePath(fontDir, fileName);
      if (!fileNames.includes(fileName)) {
        fileNames.push(fileName);
      }

      if (!fs.existsSync(filePath)) {
        debug.log(`${name}: descargando ${source.url} → ${fileName}`);
        const res = await axios.get(source.url, { responseType: "arraybuffer" });
        await fs.writeFile(filePath, res.data);
      } else {
        debug.log(`${name}: se reutiliza archivo existente ${fileName}`);
      }
    }

    debug.log(`${name}: Archivos generados (${fileNames.length}): ${fileNames.join(", ")}`);

    fontOptions.push({ name, folder, files: fileNames });
  }

  if (tsFile) {
    const ts = `// Generated automatically by mass-fonts CLI
export const FONT_OPTIONS = ${JSON.stringify(fontOptions, null, 2)};
`;
    await fs.outputFile(tsFile, ts);
    console.log(`\nArchivo de opciones generado: ${tsFile}`);
  }

  console.log(`\nDescarga completada. Archivos guardados en ${resolvedOutputDir}`);
}

async function main() {
  const debug = createDebugLogger(
    Boolean(options.debug) || Boolean(process.env.MASS_FONTS_DEBUG),
    "cli"
  );

  const { overrideWeights, forceAllVariants } = resolveWeightOverrides(
    options.weights,
    options.all
  );

  let configContext = null;
  try {
    if (options.config) {
      configContext = await loadConfigFile(path.resolve(options.config), { required: true });
    } else {
      const defaultConfigPath = path.resolve("config/fonts.config.js");
      configContext = await loadConfigFile(defaultConfigPath);
    }
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }

  const config = configContext?.config ?? null;

  const fonts = options.fonts
    ? parseFontsInput(options.fonts, overrideWeights, forceAllVariants)
    : normalizeConfigFonts(config?.fonts, overrideWeights, forceAllVariants);

  if (!fonts.length) {
    console.error(
      "Debes especificar al menos una fuente con --fonts o proporcionar un archivo de configuración (--config)."
    );
    process.exit(1);
  }

  const configSubsets = parseSubsets(config?.subsets);
  const subsetList = (() => {
    const cliSubsets = parseSubsets(options.subset);
    if (cliSubsets.length) return cliSubsets;
    if (configSubsets.length) return configSubsets;
    return ["latin"];
  })();

  const configPreferredFormats = normalizeFormats(
    config?.formats,
    FALLBACK_FORMATS
  );

  const defaultFormats = normalizeFormats(
    options.formats ?? config?.formats,
    configPreferredFormats
  );

  const outputDir = options.output ?? config?.outputDir ?? "output/fonts";
  const tsFile = options.ts
    ?? (config?.generateOptionsFile && config?.optionsFilePath
      ? config.optionsFilePath
      : null);

  await downloadFonts(
    fonts,
    outputDir,
    subsetList,
    tsFile,
    defaultFormats,
    debug,
    config?.fileNameOptions ?? null
  );
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  if (options.debug || process.env.MASS_FONTS_DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
