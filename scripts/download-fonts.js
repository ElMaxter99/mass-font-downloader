import path from "node:path";
import fs from "fs-extra";
import axios from "axios";
import { Command } from "commander";
import config from "../config/fonts.config.js";

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

const cli = new Command();

cli
  .allowUnknownOption(false)
  .option(
    "--weights <weights>",
    "Sobrescribe los pesos para todas las familias (ej: 'regular,semibold,bold')"
  )
  .option(
    "--all",
    "Ignora los pesos configurados y descarga todas las variantes disponibles"
  )
  .parse(process.argv);

const cliOptions = cli.opts();

const {
  overrideWeights,
  forceAllVariants
} = resolveWeightOverrides(cliOptions.weights, cliOptions.all);

const defaultFormats = normalizeFormats(config.formats ?? FALLBACK_FORMATS);

const {
  fonts,
  subsets,
  outputDir,
  generateOptionsFile,
  optionsFilePath,
  fileNameOptions
} = config;
const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2";
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/css,*/*;q=0.1",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://fonts.googleapis.com/",
  Origin: "https://fonts.googleapis.com",
};

const debug = createDebugLogger(Boolean(process.env.MASS_FONTS_DEBUG), "script");

function shouldRetryWithoutProxy(error) {
  if (!error) return false;
  const proxyConfigured =
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy;

  if (!proxyConfigured) return false;

  if (error.message?.includes("CONNECT tunnel failed")) return true;
  if (error.code === "ERR_BAD_REQUEST" && error.response?.status === 403) return true;
  return false;
}

async function fetchWithProxyFallback(url, options) {
  try {
    return await axios.get(url, options);
  } catch (error) {
    if (shouldRetryWithoutProxy(error)) {
      return axios.get(url, { ...options, proxy: false });
    }
    throw error;
  }
}

async function getFontCss(familyQuery, subsets) {
  const subsetParam = subsets?.length ? `&subset=${subsets.join(",")}` : "";
  const url = `${GOOGLE_FONTS_API}?${familyQuery}${subsetParam}&display=swap`;

  const { data } = await fetchWithProxyFallback(url, {
    headers: DEFAULT_HEADERS,
    responseType: "text",
    decompress: true,
  });
  return data;
}

function shouldDownloadAll(font) {
  if (forceAllVariants) return true;
  if (overrideWeights?.length) return false;
  if (font?.downloadAllVariants || font?.all === true) return true;
  if (typeof font?.weights === "string") {
    const token = font.weights.trim().toLowerCase();
    if (token === "all" || token === "*") {
      return true;
    }
  }
  return false;
}

function normalizeWeights(font) {
  if (forceAllVariants) {
    return [];
  }

  if (overrideWeights?.length) {
    return overrideWeights;
  }

  if (shouldDownloadAll(font)) {
    return [];
  }

  const { weights } = font || {};
  if (!weights) return [400];

  const raw = Array.isArray(weights)
    ? weights
    : typeof weights === "string"
      ? weights.split(",").map((token) => token.trim())
      : [weights];

  const parsed = raw
    .map((value) => resolveWeightValue(value))
    .filter((value) => Number.isFinite(value));

  return parsed.length ? parsed : [400];
}

async function downloadFonts() {
  console.log("Descargando fuentes desde Google Fonts...\n");

  const resolvedOutputDir = path.resolve(outputDir);
  await fs.ensureDir(resolvedOutputDir);
  const fontOptions = [];

  const metadataFetcher = () =>
    fetchWithProxyFallback("https://fonts.google.com/metadata/fonts", {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: "application/json,text/plain,*/*",
        Referer: "https://fonts.google.com/",
        Origin: "https://fonts.google.com"
      },
      responseType: "text"
    });

  for (const font of fonts) {
    const { name } = font;
    const downloadAll = shouldDownloadAll(font);
    const weights = normalizeWeights(font);
    const selectedFormats = normalizeFormats(font.formats, defaultFormats);
    const { query, variants } = await buildFamilyQuery(name, weights, {
      includeAllVariants: downloadAll,
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
    const effectiveFormats = selectAvailableFormats(selectedFormats, availableFormats);

    if (!effectiveFormats.length) {
      console.warn(
        `${name}: no se encontraron fuentes compatibles con los formatos solicitados (${selectedFormats.join(", ")}).`
      );
      continue;
    }

    const missingRequested = selectedFormats.filter((format) => !effectiveFormats.includes(format));
    if (missingRequested.length) {
      const fallbackMessage = `${name}: formatos no disponibles (${missingRequested.join(", ")}). Se usarán: ${effectiveFormats.join(", ")}`;
      console.warn(fallbackMessage);
      debug.log(fallbackMessage);
    }

    const displayFormats = effectiveFormats.map((format) => FORMAT_EXTENSIONS[format] ?? format);
    console.log(
      `→ ${name} (${downloadAll ? `todas las variantes${variantSummary ? `: ${variantSummary}` : ""}` : weights.join(", ")}) → formatos: ${displayFormats.join(", ")}`
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

      if (!fs.existsSync(filePath)) {
        debug.log(`${name}: descargando ${source.url} → ${fileName}`);
        const res = await fetchWithProxyFallback(source.url, {
          responseType: "arraybuffer",
          headers: {
            ...DEFAULT_HEADERS,
            Accept: "*/*",
          },
        });
        await fs.writeFile(filePath, res.data);
      } else {
        debug.log(`${name}: se reutiliza archivo existente ${fileName}`);
      }

      if (!fileNames.includes(fileName)) {
        fileNames.push(fileName);
      }
    }

    debug.log(`${name}: Archivos generados (${fileNames.length}): ${fileNames.join(", ")}`);

    fontOptions.push({ name, folder, files: fileNames });
  }

  if (generateOptionsFile) {
    const ts = `// Generated automatically by mass-font-downloader
export const FONT_OPTIONS = ${JSON.stringify(fontOptions, null, 2)};
`;
    await fs.outputFile(optionsFilePath, ts);
    console.log(`\nArchivo de opciones generado: ${optionsFilePath}`);
  }

  console.log(`\nDescarga completada. Archivos guardados en ${resolvedOutputDir}`);
}

downloadFonts().catch((err) => console.error("Error:", err));
