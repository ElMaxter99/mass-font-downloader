#!/usr/bin/env node
import fs from "fs-extra";
import axios from "axios";
import { Command } from "commander";

const FORMAT_ALIASES = {
  woff2: "woff2",
  woff: "woff",
  truetype: "truetype",
  ttf: "truetype"
};

const FORMAT_EXTENSIONS = {
  woff2: "woff2",
  woff: "woff",
  truetype: "ttf"
};

const FALLBACK_FORMATS = ["woff2"];

function normalizeFormats(formats) {
  if (!formats) return [...FALLBACK_FORMATS];
  const raw = Array.isArray(formats) ? formats : formats.split(",");
  const canonical = raw
    .map((format) => FORMAT_ALIASES[format.trim().toLowerCase()])
    .filter(Boolean);
  if (canonical.length) {
    return [...new Set(canonical)];
  }
  return [...FALLBACK_FORMATS];
}

const program = new Command();

program
  .name("mass-fonts")
  .description("Descarga masiva de fuentes desde Google Fonts (renombradas por tipografía y peso)")
  .option("-f, --fonts <fonts>", "Lista de fuentes y pesos (ej: 'Roboto:400,700;Poppins:400')")
  .option("-o, --output <dir>", "Carpeta de salida", "output/fonts")
  .option("--ts <file>", "Ruta del archivo font-options.ts (opcional)")
  .option("--subset <subset>", "Subconjunto de caracteres (latin, latin-ext...)", "latin")
  .option("--formats <formats>", "Lista separada por comas de formatos (woff2, woff, ttf)")
  .parse(process.argv);

const options = program.opts();
if (!options.fonts) {
  console.error("Debes especificar al menos una fuente con --fonts");
  process.exit(1);
}

const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2";

function parseFonts(str) {
  return str.split(";").map((entry) => {
    const [name, weights] = entry.split(":");
    return {
      name: name.trim(),
      weights: weights ? weights.split(",").map((n) => parseInt(n.trim())) : [400]
    };
  });
}

async function getFontCss(name, weights, subset) {
  const familyParam = `family=${encodeURIComponent(name)}:wght@${weights.join(";")}`;
  const subsetParam = subset ? `&subset=${subset}` : "";
  const url = `${GOOGLE_FONTS_API}?${familyParam}${subsetParam}&display=swap`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return data;
}

async function downloadFonts(fonts, outputDir, subset, tsFile, formats) {
  await fs.ensureDir(outputDir);
  const fontOptions = [];

  console.log("Descargando fuentes desde Google Fonts...\n");

  for (const { name, weights } of fonts) {
    console.log(`→ ${name} (${weights.join(", ")}) → formatos: ${formats.map((format) => FORMAT_EXTENSIONS[format] ?? format).join(", ")}`);
    const css = await getFontCss(name, weights, subset);

    const matches = [...css.matchAll(/url\((https:\/\/[^)]+)\).*?format\('(truetype|woff2|woff)'\)/g)];
    if (!matches.length) {
      console.warn(`No se encontraron URLs para ${name}`);
      continue;
    }

    const folder = name.toLowerCase().replace(/\s+/g, "-");
    const fontDir = `${outputDir}/${folder}`;
    await fs.ensureDir(fontDir);

    const fileNames = [];

    for (const match of matches) {
      const [_, url, format] = match;
      const canonicalFormat = FORMAT_ALIASES[format.toLowerCase()];
      if (!canonicalFormat || !formats.includes(canonicalFormat)) continue;
      const weightMatch = url.match(/wght@(\d+)/);
      const weight = weightMatch ? weightMatch[1] : "400";

      const extension = FORMAT_EXTENSIONS[canonicalFormat] ?? canonicalFormat;
      const fileName = `${folder}-${weight}.${extension}`;
      const filePath = `${fontDir}/${fileName}`;
      if (!fileNames.includes(fileName)) {
        fileNames.push(fileName);
      }

      if (!fs.existsSync(filePath)) {
        const res = await axios.get(url, { responseType: "arraybuffer" });
        await fs.writeFile(filePath, res.data);
      }
    }

    fontOptions.push({ name, folder, files: fileNames });
  }

  if (tsFile) {
    const ts = `// Generated automatically by mass-fonts CLI
export const FONT_OPTIONS = ${JSON.stringify(fontOptions, null, 2)};
`;
    await fs.outputFile(tsFile, ts);
    console.log(`\nArchivo de opciones generado: ${tsFile}`);
  }

  console.log(`\nDescarga completada. Archivos guardados en ${outputDir}`);
}

const fonts = parseFonts(options.fonts);
const formats = normalizeFormats(options.formats);
downloadFonts(fonts, options.output, options.subset, options.ts, formats).catch((err) => {
  console.error("Error:", err.message);
});
