import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeFormats,
  extractSourcesFromCss,
  resolveAllVariants,
  buildFamilyQuery,
  formatVariantSummary,
  buildFileName,
  slugifyFontFolder,
  FORMAT_ALIASES,
  FORMAT_EXTENSIONS,
  selectAvailableFormats,
  FORMAT_PRIORITY
} from "../lib/font-utils.js";

const metadataResponse = {
  familyMetadataList: [
    {
      family: "Roboto",
      variants: ["regular", "italic", "500", "700italic"]
    },
    {
      family: "Multi Axis",
      variants: ["regular", "italic"],
      axes: [
        { tag: "opsz", min: 14, max: 32 },
        { tag: "wght", min: 100, max: 900, step: 100 },
        { tag: "ital", start: 0, end: 1, step: 1 }
      ]
    },
    {
      family: "Fallback",
      fonts: [
        { fontStyle: "normal", fontWeight: "400" },
        { fontStyle: "italic", fontWeight: "400" },
        { style: "normal", weight: 700 }
      ]
    },
    {
      family: "Variable Family",
      axes: [
        { tag: "wght", start: 200, end: 600, step: 200 },
        { tag: "ital", start: 0, end: 1, step: 1 }
      ]
    }
  ]
};

const metadataFetcher = async () => ({ data: metadataResponse });

test("normalizeFormats returns canonical list when input is string", () => {
  const result = normalizeFormats("WOFF2, ttf, unknown");
  assert.deepEqual(result, ["woff2", "truetype"]);
});

test("normalizeFormats maps variation formats to their canonical counterparts", () => {
  const result = normalizeFormats(["woff2-variations", "truetype-variations", "woff-variations"]);
  assert.deepEqual(result, ["woff2", "truetype", "woff"]);
});

test("normalizeFormats falls back to defaults when no valid formats provided", () => {
  const result = normalizeFormats(null);
  assert.deepEqual(result, ["woff2"]);
});

test("selectAvailableFormats returns requested formats when available", () => {
  const result = selectAvailableFormats(["woff2", "woff"], ["woff", "woff2", "truetype"]);
  assert.deepEqual(result, ["woff2", "woff"]);
});

test("selectAvailableFormats falls back to priority order when requested missing", () => {
  const result = selectAvailableFormats(["woff2"], ["truetype"]);
  assert.deepEqual(result, ["truetype"]);
});

test("FORMAT_PRIORITY keeps preferred order", () => {
  assert.deepEqual(FORMAT_PRIORITY, ["woff2", "woff", "truetype"]);
});

test("extractSourcesFromCss reads urls, weights and italic flag", () => {
  const css = `
    @font-face {
      font-family: 'Roboto';
      font-style: normal;
      font-weight: 400;
      src: url(https://example.com/roboto-400.woff2) format('woff2');
    }
    @font-face {
      font-family: 'Roboto';
      font-style: italic;
      font-weight: 400;
      src: url("https://example.com/roboto-400italic.woff2") format("woff2");
    }
  `;

  const sources = extractSourcesFromCss(css);
  assert.equal(sources.length, 2);
  assert.deepEqual(sources[0], {
    url: "https://example.com/roboto-400.woff2",
    format: "woff2",
    italic: false,
    weight: "400"
  });
  assert.deepEqual(sources[1], {
    url: "https://example.com/roboto-400italic.woff2",
    format: "woff2",
    italic: true,
    weight: "400"
  });
});

test("extractSourcesFromCss handles variation formats", () => {
  const css = `
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 100 900;
      src: url(https://example.com/inter-variable.woff2) format('woff2-variations');
    }
  `;

  const sources = extractSourcesFromCss(css);
  assert.equal(sources.length, 1);
  assert.deepEqual(sources[0], {
    url: "https://example.com/inter-variable.woff2",
    format: "woff2-variations",
    italic: false,
    weight: "100-900"
  });
});

test("resolveAllVariants parses variants, fonts and axes", async () => {
  const roboto = await resolveAllVariants("Roboto", { metadataFetcher });
  assert.equal(roboto.source, "variants");
  assert.deepEqual(roboto.variants, [
    { weight: 400, italic: false, source: "variants" },
    { weight: 400, italic: true, source: "variants" },
    { weight: 500, italic: false, source: "variants" },
    { weight: 700, italic: true, source: "variants" }
  ]);

  const fallback = await resolveAllVariants("Fallback", { metadataFetcher });
  assert.equal(fallback.source, "fonts");
  assert.deepEqual(fallback.variants, [
    { weight: 400, italic: false, source: "fonts" },
    { weight: 400, italic: true, source: "fonts" },
    { weight: 700, italic: false, source: "fonts" }
  ]);

  const generated = await resolveAllVariants("Variable Family", { metadataFetcher });
  assert.equal(generated.source, "axes");
  assert.deepEqual(generated.variants, [
    { weight: 200, italic: false, source: "axes" },
    { weight: 200, italic: true, source: "axes" },
    { weight: 400, italic: false, source: "axes" },
    { weight: 400, italic: true, source: "axes" },
    { weight: 600, italic: false, source: "axes" },
    { weight: 600, italic: true, source: "axes" }
  ]);
});

test("resolveAllVariants throws when family not found", async () => {
  await assert.rejects(() => resolveAllVariants("Missing", { metadataFetcher }), {
    message: /No se encontró metadata/
  });
});

test("buildFamilyQuery returns weighted query when explicit weights provided", async () => {
  const { query, variants } = await buildFamilyQuery("Roboto", [700, "400"], {
    metadataFetcher
  });

  assert.equal(query, "family=Roboto:wght@400;700");
  assert.deepEqual(variants, [
    { weight: 400, italic: false },
    { weight: 700, italic: false }
  ]);
});

test("buildFamilyQuery builds ital axis query when includeAllVariants is true", async () => {
  const { query, variants } = await buildFamilyQuery(
    "Roboto",
    [],
    {
      includeAllVariants: true,
      metadataFetcher
    }
  );

  assert.equal(query, "family=Roboto:ital,wght@0,400;0,500;1,400;1,700");
  assert.deepEqual(variants, [
    { weight: 400, italic: false },
    { weight: 400, italic: true },
    { weight: 500, italic: false },
    { weight: 700, italic: true }
  ]);
});

test("buildFamilyQuery adds additional axes when metadata exposes them", async () => {
  const { query, variants } = await buildFamilyQuery(
    "Multi Axis",
    [],
    {
      includeAllVariants: true,
      metadataFetcher
    }
  );

  assert.equal(query, "family=Multi%20Axis:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900");
  assert.deepEqual(variants, [
    { weight: 400, italic: false },
    { weight: 400, italic: true }
  ]);
});

test("buildFamilyQuery compacts axis ranges when metadata only exposes axes", async () => {
  const { query, variants } = await buildFamilyQuery(
    "Variable Family",
    [],
    {
      includeAllVariants: true,
      metadataFetcher
    }
  );

  assert.equal(query, "family=Variable%20Family:ital,wght@0,200..600;1,200..600");
  assert.deepEqual(variants, [
    { weight: 200, italic: false },
    { weight: 200, italic: true },
    { weight: 400, italic: false },
    { weight: 400, italic: true },
    { weight: 600, italic: false },
    { weight: 600, italic: true }
  ]);
});

test("formatVariantSummary and buildFileName produce expected strings", () => {
  const summary = formatVariantSummary([
    { weight: 400, italic: false },
    { weight: 400, italic: true },
    { weight: 700, italic: false }
  ]);
  assert.equal(summary, "400, 700, 400i");

  const fileName = buildFileName("roboto", 400, true, "woff2");
  assert.equal(fileName, "roboto-400-italic.woff2");
});

test("slugifyFontFolder normalizes font names safely", () => {
  assert.equal(slugifyFontFolder("Noto Sans JP"), "noto-sans-jp");
  assert.equal(slugifyFontFolder("../Weird/Name"), "weird-name");
  assert.equal(slugifyFontFolder(""), "font");
});

test("buildFileName sanitizes path traversal attempts", () => {
  const fileName = buildFileName("../Roboto", "../400", true, "../WOFF2");
  assert.equal(fileName, "roboto-400-italic.woff2");
});

test("formatVariantSummary condenses large sequential ranges", () => {
  const variants = [];
  for (let weight = 100; weight <= 900; weight += 100) {
    variants.push({ weight, italic: false });
    variants.push({ weight, italic: true });
  }

  const summary = formatVariantSummary(variants);
  assert.equal(summary, "100..900, 100..900i");
});

test("format maps expose expected extensions", () => {
  assert.equal(FORMAT_ALIASES.woff2, "woff2");
  assert.equal(FORMAT_EXTENSIONS.truetype, "ttf");
});
