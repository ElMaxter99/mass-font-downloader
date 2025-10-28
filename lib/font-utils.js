import axios from "axios";

export const FORMAT_ALIASES = {
  woff2: "woff2",
  woff: "woff",
  truetype: "truetype",
  ttf: "truetype"
};

export const FORMAT_EXTENSIONS = {
  woff2: "woff2",
  woff: "woff",
  truetype: "ttf"
};

export const FALLBACK_FORMATS = ["woff2"];

export function normalizeFormats(formats, fallback = FALLBACK_FORMATS) {
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

const FONT_FACE_BLOCK_REGEX = /@font-face\s*{[^}]+}/gi;
const FONT_SRC_REGEX = /url\((['"]?)(https:\/\/[^)'"\s]+)\1\)\s*format\(['"](truetype|woff2|woff)['"]\)/gi;

export function extractSourcesFromCss(css) {
  const sources = [];
  for (const match of css.matchAll(FONT_FACE_BLOCK_REGEX)) {
    const block = match[0];
    const styleMatch = block.match(/font-style:\s*([^;]+);/i);
    const italic = styleMatch ? /italic|oblique/i.test(styleMatch[1]) : false;

    const weightMatch = block.match(/font-weight:\s*([0-9]+(?:\s+[0-9]+)?)/i);
    const weightLabel = weightMatch ? weightMatch[1].trim().replace(/\s+/g, "-") : "400";

    for (const srcMatch of block.matchAll(FONT_SRC_REGEX)) {
      sources.push({
        url: srcMatch[2],
        format: srcMatch[3].toLowerCase(),
        italic,
        weight: weightLabel
      });
    }
  }

  return sources;
}

const FONT_METADATA_URL = "https://fonts.google.com/metadata/fonts";
const METADATA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://fonts.google.com/"
};

let metadataCache = null;
let metadataPromise = null;

async function loadMetadata(fetcher) {
  if (metadataCache) return metadataCache;
  if (!metadataPromise) {
    const effectiveFetcher = fetcher
      ? fetcher
      : () =>
          axios.get(FONT_METADATA_URL, {
            headers: METADATA_HEADERS,
            responseType: "text"
          });

    metadataPromise = effectiveFetcher().then((response) => {
      const text =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      const sanitized = text.replace(/^\)\]\}'/, "");
      const parsed = JSON.parse(sanitized);
      const list = parsed.familyMetadataList || parsed.fonts || [];
      metadataCache = list;
      return metadataCache;
    });
  }

  return metadataPromise;
}

function parseVariantEntry(variant) {
  if (!variant) return null;
  if (typeof variant === "string") {
    const lower = variant.toLowerCase();
    if (lower === "regular") {
      return { weight: 400, italic: false };
    }
    if (lower === "italic") {
      return { weight: 400, italic: true };
    }
    const italic = lower.endsWith("italic");
    const numericPart = italic ? lower.replace("italic", "") : lower;
    const weight = parseInt(numericPart, 10);
    if (Number.isFinite(weight)) {
      return { weight, italic };
    }
    return null;
  }

  if (typeof variant === "object") {
    const style = (variant.style || variant.fontStyle || variant.italicStyle || "normal")
      .toString()
      .toLowerCase();
    const italic = /italic|oblique/.test(style);

    const possibleWeights = [
      variant.weight,
      variant.fontWeight,
      variant.ttfWeight,
      variant.wght,
      variant.axisValue
    ].filter((value) => value !== undefined && value !== null);

    for (const value of possibleWeights) {
      const numeric = parseInt(value, 10);
      if (Number.isFinite(numeric)) {
        return { weight: numeric, italic };
      }
      if (typeof value === "string") {
        const match = value.match(/([0-9]+)/);
        if (match) {
          return { weight: parseInt(match[1], 10), italic };
        }
      }
    }
  }

  return null;
}

function generateVariantsFromAxes(entry) {
  const axes = Array.isArray(entry.axes) ? entry.axes : [];
  const wghtAxis = axes.find((axis) => axis.tag === "wght");
  if (!wghtAxis) return [];

  const italicAxis = axes.find((axis) => axis.tag === "ital");
  const start = Number.isFinite(wghtAxis.start) ? wghtAxis.start : 100;
  const end = Number.isFinite(wghtAxis.end) ? wghtAxis.end : start;
  const step = Number.isFinite(wghtAxis.step) && wghtAxis.step > 0 ? wghtAxis.step : 100;

  const variants = [];
  for (let weight = start; weight <= end; weight += step) {
    variants.push({ weight, italic: false });
    if (italicAxis && italicAxis.end >= 1) {
      variants.push({ weight, italic: true });
    }
  }

  return variants;
}

export async function resolveAllVariants(name, { metadataFetcher } = {}) {
  const metadata = await loadMetadata(metadataFetcher);
  const target = metadata.find((entry) => entry.family?.toLowerCase() === name.toLowerCase());
  if (!target) {
    throw new Error(`No se encontró metadata para la familia "${name}".`);
  }

  const variants = new Map();
  let variantSource = null;

  if (Array.isArray(target.variants) && target.variants.length) {
    variantSource = "variants";
    for (const variant of target.variants) {
      const parsed = parseVariantEntry(variant);
      if (parsed) {
        const key = `${parsed.italic ? 1 : 0}-${parsed.weight}`;
        variants.set(key, { ...parsed, source: "variants" });
      }
    }
  }

  if (!variants.size && Array.isArray(target.fonts) && target.fonts.length) {
    variantSource = "fonts";
    for (const font of target.fonts) {
      const parsed = parseVariantEntry(font);
      if (parsed) {
        const key = `${parsed.italic ? 1 : 0}-${parsed.weight}`;
        variants.set(key, { ...parsed, source: "fonts" });
      }
    }
  }

  if (!variants.size) {
    variantSource = "axes";
    for (const generated of generateVariantsFromAxes(target)) {
      const key = `${generated.italic ? 1 : 0}-${generated.weight}`;
      variants.set(key, { ...generated, source: "axes" });
    }
  }

  if (!variants.size) {
    throw new Error(`No se pudieron determinar las variantes disponibles para "${name}".`);
  }

  const sorted = Array.from(variants.values()).sort((a, b) => {
    if (a.weight === b.weight) {
      return Number(a.italic) - Number(b.italic);
    }
    return a.weight - b.weight;
  });

  return {
    variants: sorted,
    source: variantSource
  };
}

function formatAxisEntries(weights, italicFlag, useRanges) {
  if (!weights.length) return [];
  const unique = [...new Set(weights)].sort((a, b) => a - b);

  if (useRanges && unique.length > 1) {
    const step = unique[1] - unique[0];
    if (step > 0 && unique.every((value, index) => index === 0 || value - unique[index - 1] === step)) {
      const start = unique[0];
      const end = unique[unique.length - 1];
      return [`${italicFlag},${start}..${end}`];
    }
  }

  return unique.map((weight) => `${italicFlag},${weight}`);
}

export async function buildFamilyQuery(name, weights, { includeAllVariants = false, metadataFetcher } = {}) {
  if (includeAllVariants) {
    const { variants: resolvedVariants, source } = await resolveAllVariants(name, { metadataFetcher });
    const normalizedVariants = resolvedVariants.map(({ weight, italic }) => ({ weight, italic }));
    const normalWeights = normalizedVariants.filter((variant) => !variant.italic).map((variant) => variant.weight);
    const italicWeights = normalizedVariants.filter((variant) => variant.italic).map((variant) => variant.weight);

    const useRanges = source === "axes";
    const entries = [];
    if (normalWeights.length) {
      entries.push(...formatAxisEntries(normalWeights, 0, useRanges));
    }
    if (italicWeights.length) {
      entries.push(...formatAxisEntries(italicWeights, 1, useRanges));
    }

    const axis = italicWeights.length ? "ital,wght" : "wght";
    const query = `family=${encodeURIComponent(name)}:${axis}@${entries.join(";")}`;

    return { query, variants: normalizedVariants };
  }

  const sanitized = Array.isArray(weights)
    ? weights
        .map((value) => parseInt(value, 10))
        .filter((value) => Number.isFinite(value))
    : [];

  if (!sanitized.length) {
    sanitized.push(400);
  }

  const uniqueWeights = [...new Set(sanitized)].sort((a, b) => a - b);
  const query = `family=${encodeURIComponent(name)}:wght@${uniqueWeights.join(";")}`;

  return {
    query,
    variants: uniqueWeights.map((weight) => ({ weight, italic: false }))
  };
}

export function formatVariantSummary(variants) {
  return variants
    .map((variant) => `${variant.weight}${variant.italic ? "i" : ""}`)
    .join(", ");
}

export function buildFileName(folder, weight, italic, extension) {
  const suffix = italic ? "-italic" : "";
  return `${folder}-${weight}${suffix}.${extension}`;
}
