import fs from "fs-extra";
import axios from "axios";
import config from "../config/fonts.config.js";

import {
  FORMAT_ALIASES,
  FORMAT_EXTENSIONS,
  FALLBACK_FORMATS,
  normalizeFormats,
  buildFamilyQuery,
  extractSourcesFromCss,
  formatVariantSummary,
  buildFileName
} from "../lib/font-utils.js";

const defaultFormats = normalizeFormats(config.formats ?? FALLBACK_FORMATS);

const { fonts, subsets, outputDir, generateOptionsFile, optionsFilePath } = config;
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
  if (shouldDownloadAll(font)) {
    return [];
  }

  const { weights } = font || {};
  if (!weights) return [400];
  if (Array.isArray(weights)) {
    const sanitized = weights
      .map((value) => parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
    return sanitized.length ? sanitized : [400];
  }

  if (typeof weights === "string") {
    const parts = weights
      .split(",")
      .map((value) => parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value));
    return parts.length ? parts : [400];
  }

  return [400];
}

async function downloadFonts() {
  console.log("Descargando fuentes desde Google Fonts...\n");

  await fs.ensureDir(outputDir);
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
    const displayFormats = selectedFormats.map((format) => FORMAT_EXTENSIONS[format] ?? format);
    const { query, variants } = await buildFamilyQuery(name, weights, {
      includeAllVariants: downloadAll,
      metadataFetcher
    });
    const variantSummary = formatVariantSummary(variants);
    console.log(
      `→ ${name} (${downloadAll ? `todas las variantes${variantSummary ? `: ${variantSummary}` : ""}` : weights.join(", ")}) → formatos: ${displayFormats.join(", ")}`
    );
    const css = await getFontCss(query, subsets);

    const sources = extractSourcesFromCss(css);

    if (!sources.length) {
      console.warn(`No se encontraron URLs para ${name}`);
      continue;
    }

    const folder = name.toLowerCase().replace(/\s+/g, "-");
    const fontDir = `${outputDir}/${folder}`;
    await fs.ensureDir(fontDir);

    const fileNames = [];

    for (const source of sources) {
      const canonicalFormat = FORMAT_ALIASES[source.format];
      if (!canonicalFormat || !selectedFormats.includes(canonicalFormat)) continue;

      const extension = FORMAT_EXTENSIONS[canonicalFormat] ?? canonicalFormat;
      const fileName = buildFileName(folder, source.weight, source.italic, extension);
      const filePath = `${fontDir}/${fileName}`;

      if (!fs.existsSync(filePath)) {
        const res = await fetchWithProxyFallback(source.url, {
          responseType: "arraybuffer",
          headers: {
            ...DEFAULT_HEADERS,
            Accept: "*/*",
          },
        });
        await fs.writeFile(filePath, res.data);
      }

      if (!fileNames.includes(fileName)) {
        fileNames.push(fileName);
      }
    }

    fontOptions.push({ name, folder, files: fileNames });
  }

  if (generateOptionsFile) {
    const ts = `// Generated automatically by mass-font-downloader
export const FONT_OPTIONS = ${JSON.stringify(fontOptions, null, 2)};
`;
    await fs.outputFile(optionsFilePath, ts);
    console.log(`\nArchivo de opciones generado: ${optionsFilePath}`);
  }

  console.log(`\nDescarga completada. Archivos guardados en ${outputDir}`);
}

downloadFonts().catch((err) => console.error("Error:", err));
