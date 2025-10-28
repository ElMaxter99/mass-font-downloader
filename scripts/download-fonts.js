import fs from "fs-extra";
import axios from "axios";
import config from "../config/fonts.config.js";

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
  console.log("📦 Descargando fuentes desde Google Fonts...\n");

  await fs.ensureDir(outputDir);
  const fontOptions = [];

  for (const { name, weights = [400] } of fonts) {
    console.log(`→ ${name} (${weights.join(", ")})`);
    const css = await getFontCss(name, weights, subsets);

    const matches = [...css.matchAll(/url\((https:\/\/[^)]+)\).*?format\('(truetype|woff2|woff)'\)/g)];

    if (!matches.length) {
      console.warn(`⚠️ No se encontraron URLs para ${name}`);
      continue;
    }

    const folder = name.toLowerCase().replace(/\s+/g, "-");
    const fontDir = `${outputDir}/${folder}`;
    await fs.ensureDir(fontDir);

    const fileNames = [];

    for (const match of matches) {
      const [_, url, format] = match;
      if (format !== "truetype") continue; // solo .ttf
      const weightMatch = url.match(/wght@(\d+)/);
      const weight = weightMatch ? weightMatch[1] : "400";

      const fileName = `${folder}-${weight}.ttf`;
      const filePath = `${fontDir}/${fileName}`;

      if (!fs.existsSync(filePath)) {
        const res = await axios.get(url, { responseType: "arraybuffer" });
        await fs.writeFile(filePath, res.data);
      }

      fileNames.push(fileName);
    }

    fontOptions.push({ name, folder, files: fileNames });
  }

  if (generateOptionsFile) {
    const ts = `// ⚡️ Generated automatically by mass-font-downloader
export const FONT_OPTIONS = ${JSON.stringify(fontOptions, null, 2)};
`;
    await fs.outputFile(optionsFilePath, ts);
    console.log(`\n✅ Archivo de opciones generado: ${optionsFilePath}`);
  }

  console.log(`\n🎉 Descarga completada. Archivos guardados en ${outputDir}`);
}

downloadFonts().catch((err) => console.error("❌ Error:", err));
