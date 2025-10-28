import fs from "fs-extra";
import axios from "axios";
import config from "../config/fonts.config.js";

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

function normalizeFormats(formats, fallback = FALLBACK_FORMATS) {
  const raw = Array.isArray(formats)
    ? formats
    : typeof formats === "string"
      ? formats.split(",")
      : [];

  const canonical = raw
    .map((format) => FORMAT_ALIASES[format.trim().toLowerCase()])
    .filter(Boolean);

  if (canonical.length) {
    return [...new Set(canonical)];
  }

  return [...new Set(fallback)];
}

const defaultFormats = normalizeFormats(config.formats ?? FALLBACK_FORMATS);

const { fonts, subsets, outputDir, generateOptionsFile, optionsFilePath } = config;
const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2";

async function getFontCss(name, weights, subsets) {
  const familyParam = `family=${encodeURIComponent(name)}:wght@${weights.join(";")}`;
  const subsetParam = subsets?.length ? `&subset=${subsets.join(",")}` : "";
  const url = `${GOOGLE_FONTS_API}?${familyParam}${subsetParam}&display=swap`;

  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" } // necesario para Google Fonts
  });
  return data;
}

async function downloadFonts() {
  console.log("Descargando fuentes desde Google Fonts...\n");

  await fs.ensureDir(outputDir);
  const fontOptions = [];

  for (const { name, weights = [400], formats } of fonts) {
    const selectedFormats = normalizeFormats(formats, defaultFormats);
    const displayFormats = selectedFormats.map((format) => FORMAT_EXTENSIONS[format] ?? format);
    console.log(`→ ${name} (${weights.join(", ")}) → formatos: ${displayFormats.join(", ")}`);
    const css = await getFontCss(name, weights, subsets);

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
      if (!canonicalFormat || !selectedFormats.includes(canonicalFormat)) continue;
      const weightMatch = url.match(/wght@(\d+)/);
      const weight = weightMatch ? weightMatch[1] : "400";

      const extension = FORMAT_EXTENSIONS[canonicalFormat] ?? canonicalFormat;
      const fileName = `${folder}-${weight}.${extension}`;
      const filePath = `${fontDir}/${fileName}`;

      if (!fs.existsSync(filePath)) {
        const res = await axios.get(url, { responseType: "arraybuffer" });
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
