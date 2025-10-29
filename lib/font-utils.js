import axios from "axios";

export const FORMAT_ALIASES = {
  woff2: "woff2",
  "woff2-variations": "woff2",
  woff: "woff",
  "woff-variations": "woff",
  truetype: "truetype",
  "truetype-variations": "truetype",
  ttf: "truetype"
};

export const FORMAT_EXTENSIONS = {
  woff2: "woff2",
  woff: "woff",
  truetype: "ttf"
};

export const FALLBACK_FORMATS = ["woff2"];
export const FORMAT_PRIORITY = ["woff2", "woff", "truetype"];

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

export function selectAvailableFormats(preferredFormats, availableFormats) {
  const requested = Array.isArray(preferredFormats) && preferredFormats.length
    ? preferredFormats
    : FALLBACK_FORMATS;

  const availableSet = new Set(
    (availableFormats || []).map((format) => FORMAT_ALIASES[format] ?? format).filter(Boolean)
  );

  const matchingRequested = requested.filter((format) => availableSet.has(format));
  if (matchingRequested.length) {
    return matchingRequested;
  }

  for (const candidate of FORMAT_PRIORITY) {
    if (availableSet.has(candidate)) {
      return [candidate];
    }
  }

  if (availableSet.size) {
    return [...availableSet];
  }

  return [];
}

const FONT_FACE_BLOCK_REGEX = /@font-face\s*{[^}]+}/gi;
const FONT_SRC_REGEX =
  /url\((['"]?)(https:\/\/[^)'"\s]+)\1\)\s*format\(['"](truetype|woff2|woff|woff2-variations|woff-variations|truetype-variations)['"]\)/gi;

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

function coerceNumeric(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function pickAxisValue(axis, keys) {
  for (const key of keys) {
    if (axis && axis[key] !== undefined && axis[key] !== null) {
      const numeric = coerceNumeric(axis[key]);
      if (numeric !== null) {
        return numeric;
      }
    }
  }
  return null;
}

function normalizeAxis(axis) {
  if (!axis || !axis.tag) return null;

  const start = pickAxisValue(axis, ["start", "min", "minimum", "lower", "default", "defaultValue"]);
  const end = pickAxisValue(axis, ["end", "max", "maximum", "upper", "default", "defaultValue"]);
  const step = pickAxisValue(axis, ["step", "increment", "precision"]);

  return {
    tag: axis.tag,
    start,
    end,
    step
  };
}

function formatAxisNumber(value) {
  if (value === null || value === undefined) return null;
  if (Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toString().replace(/\.0+$/, "");
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = coerceNumeric(value);
    if (numeric !== null) {
      return formatAxisNumber(numeric);
    }
    return value.trim();
  }
  return null;
}

function formatAxisRange(axis) {
  if (!axis) return null;
  const start = formatAxisNumber(axis.start ?? axis.end);
  const end = formatAxisNumber(axis.end ?? axis.start);

  if (start && end && start !== end) {
    return `${start}..${end}`;
  }

  return start || end;
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
  const axes = Array.isArray(entry.axes) ? entry.axes.map(normalizeAxis).filter(Boolean) : [];
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
    source: variantSource,
    metadata: target
  };
}

function formatWeightEntries(weights, { italicFlag, useRanges, additionalAxisValues, weightRange }) {
  const unique = [...new Set(weights)].sort((a, b) => a - b);
  const axisValues = Array.isArray(additionalAxisValues) ? additionalAxisValues : [];

  const buildPayload = (value) => {
    const payload = [String(value)];
    if (axisValues.length) {
      payload.unshift(...axisValues);
    }
    if (italicFlag !== null && italicFlag !== undefined) {
      payload.unshift(String(italicFlag));
    }
    return payload.join(",");
  };

  if (weightRange) {
    return [buildPayload(weightRange)];
  }

  if (!unique.length) return [];

  if (useRanges && unique.length > 1) {
    const step = unique[1] - unique[0];
    if (step > 0 && unique.every((value, index) => index === 0 || value - unique[index - 1] === step)) {
      const start = unique[0];
      const end = unique[unique.length - 1];
      return [buildPayload(`${start}..${end}`)];
    }
  }

  return unique.map((weight) => buildPayload(weight));
}

export async function buildFamilyQuery(name, weights, { includeAllVariants = false, metadataFetcher } = {}) {
  if (includeAllVariants) {
    const { variants: resolvedVariants, source, metadata } = await resolveAllVariants(name, { metadataFetcher });
    const normalizedVariants = resolvedVariants.map(({ weight, italic }) => ({ weight, italic }));
    const normalWeights = normalizedVariants.filter((variant) => !variant.italic).map((variant) => variant.weight);
    const italicWeights = normalizedVariants.filter((variant) => variant.italic).map((variant) => variant.weight);

    const useRanges = source === "axes";
    const normalizedAxes = Array.isArray(metadata?.axes)
      ? metadata.axes.map(normalizeAxis).filter(Boolean)
      : [];

    const extraAxes = normalizedAxes.filter((axis) => axis.tag !== "wght" && axis.tag !== "ital");
    const extraAxisValues = extraAxes
      .map((axis) => ({ tag: axis.tag, value: formatAxisRange(axis) }))
      .filter((entry) => Boolean(entry.value));

    const wghtAxis = normalizedAxes.find((axis) => axis.tag === "wght");
    const wghtAxisRange = formatAxisRange(wghtAxis);
    const shouldUseAxisRange =
      source === "axes" ||
      (wghtAxisRange && wghtAxisRange.includes(".."));

    const includeItalicAxis = italicWeights.length > 0 || normalizedAxes.some((axis) => axis.tag === "ital");
    const axisOrder = [];
    if (includeItalicAxis) {
      axisOrder.push("ital");
    }
    for (const entry of extraAxisValues) {
      axisOrder.push(entry.tag);
    }
    axisOrder.push("wght");

    const axisValuePayload = extraAxisValues.map((entry) => entry.value);

    const entries = [];
    if (normalWeights.length || (shouldUseAxisRange && wghtAxisRange)) {
      entries.push(
        ...formatWeightEntries(normalWeights, {
          italicFlag: includeItalicAxis ? 0 : null,
          useRanges: shouldUseAxisRange ? true : useRanges,
          additionalAxisValues: axisValuePayload,
          weightRange: shouldUseAxisRange ? wghtAxisRange : null
        })
      );
    }
    if (italicWeights.length) {
      entries.push(
        ...formatWeightEntries(italicWeights, {
          italicFlag: includeItalicAxis ? 1 : null,
          useRanges: shouldUseAxisRange ? true : useRanges,
          additionalAxisValues: axisValuePayload,
          weightRange: shouldUseAxisRange ? wghtAxisRange : null
        })
      );
    }

    if (!entries.length) {
      throw new Error(`No se pudieron determinar las variantes disponibles para "${name}".`);
    }

    const query = `family=${encodeURIComponent(name)}:${axisOrder.join(",")}@${entries.join(";")}`;

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
  if (!Array.isArray(variants) || !variants.length) return "";

  const normalWeights = [];
  const italicWeights = [];

  for (const variant of variants) {
    if (variant.italic) {
      italicWeights.push(variant.weight);
    } else {
      normalWeights.push(variant.weight);
    }
  }

  const formatGroup = (weights, italic) => {
    if (!weights.length) return [];
    const unique = [...new Set(weights)].sort((a, b) => a - b);
    if (unique.length > 6) {
      const step = unique[1] - unique[0];
      if (step > 0 && unique.every((value, index) => index === 0 || value - unique[index - 1] === step)) {
        const start = unique[0];
        const end = unique[unique.length - 1];
        return [`${start}..${end}${italic ? "i" : ""}`];
      }
    }

    return unique.map((weight) => `${weight}${italic ? "i" : ""}`);
  };

  return [...formatGroup(normalWeights, false), ...formatGroup(italicWeights, true)].join(", ");
}

function sanitizeFileNameSegment(value, { fallback = "segment", allowDot = false } = {}) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\\/]/g, "-");

  const disallowed = allowDot ? /[^a-z0-9._-]/g : /[^a-z0-9_-]/g;
  const sanitized = normalized
    .replace(disallowed, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || fallback;
}

export function slugifyFontFolder(name) {
  return sanitizeFileNameSegment(name, { fallback: "font" });
}

export function buildFileName(folder, weight, italic, extension) {
  const safeFolder = sanitizeFileNameSegment(folder, { fallback: "font" });
  const safeWeight = sanitizeFileNameSegment(weight, { fallback: "regular" });
  const safeExtension = sanitizeFileNameSegment(extension, { fallback: "bin", allowDot: false });
  const suffix = italic ? "-italic" : "";
  return `${safeFolder}-${safeWeight}${suffix}.${safeExtension}`;
}
