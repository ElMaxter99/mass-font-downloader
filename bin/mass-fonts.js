#!/usr/bin/env node
import path from "node:path";
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
  slugifyFontFolder
} from "../lib/font-utils.js";
import { createDebugLogger } from "../lib/debug.js";
import { resolveSafePath } from "../lib/path-utils.js";

const program = new Command();

program
  .name("mass-fonts")
  .description("Descarga masiva de fuentes desde Google Fonts (renombradas por tipografía y peso)")
  .option("-f, --fonts <fonts>", "Lista de fuentes y pesos (ej: 'Roboto:400,700;Poppins:400')")
  .option("-o, --output <dir>", "Carpeta de salida", "output/fonts")
  .option("--ts <file>", "Ruta del archivo font-options.ts (opcional)")
  .option("--subset <subset>", "Subconjunto de caracteres (latin, latin-ext...)", "latin")
  .option("--formats <formats>", "Lista separada por comas de formatos (woff2, woff, ttf)")
  .option("--all", "Descargar todas las variantes disponibles de cada familia")
  .option("--debug", "Muestra información detallada de depuración")
  .parse(process.argv);

const options = program.opts();
if (!options.fonts) {
  console.error("Debes especificar al menos una fuente con --fonts");
  process.exit(1);
}

const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2";

function parseFonts(str, downloadAllVariants) {
  return str.split(";").map((entry) => {
    const [name, weights] = entry.split(":");
    const trimmedWeights = weights ? weights.trim() : "";
    const isAllToken = ["*", "all"].includes(trimmedWeights.toLowerCase());
    const includeAll = downloadAllVariants || isAllToken;
    const parsedWeights = !includeAll && trimmedWeights
      ? trimmedWeights.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => Number.isFinite(n))
      : [];
    return {
      name: name.trim(),
      weights: parsedWeights.length ? parsedWeights : includeAll ? [] : [400],
      includeAll
    };
  });
}

async function getFontCss(familyQuery, subset) {
  const subsetParam = subset ? `&subset=${subset}` : "";
  const url = `${GOOGLE_FONTS_API}?${familyQuery}${subsetParam}&display=swap`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return data;
}

async function downloadFonts(fonts, outputDir, subset, tsFile, formats, debug) {
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

  for (const { name, weights, includeAll } of fonts) {
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

    const css = await getFontCss(query, subset);
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
    const effectiveFormats = selectAvailableFormats(formats, availableFormats);

    if (!effectiveFormats.length) {
      console.warn(
        `${name}: no se encontraron fuentes compatibles con los formatos solicitados (${formats.join(", ")}).`
      );
      continue;
    }

    const missingRequested = formats.filter((format) => !effectiveFormats.includes(format));
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
      const fileName = buildFileName(folder, source.weight, source.italic, source.extension);
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

const fonts = parseFonts(options.fonts, Boolean(options.all));
const formats = normalizeFormats(options.formats);
const debug = createDebugLogger(Boolean(options.debug) || Boolean(process.env.MASS_FONTS_DEBUG), "cli");

downloadFonts(fonts, options.output, options.subset, options.ts, formats, debug).catch((err) => {
  console.error("Error:", err.message);
  if (options.debug || process.env.MASS_FONTS_DEBUG) {
    console.error(err);
  }
});
