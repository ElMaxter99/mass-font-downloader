/**
 * Configuración extendida para `mass-font-downloader`.
 *
 * - Mantén solo los campos `name` y `weights` si buscas una configuración mínima.
 * - El resto de propiedades son ejemplos opcionales para documentar lo que podrías querer anotar
 *   (pares sugeridos, formatos preferidos, subconjuntos particulares, etc.).
 * - El script oficial únicamente usa `fonts`, `formats`, `subsets`, `outputDir`,
 *   `generateOptionsFile` y `optionsFilePath`, pero dejamos un montón de ideas para que puedas adaptarlo
 *   rápidamente a tus necesidades.
 */

const OUTPUT_ROOT = "output/fonts"; // Directorio base de descarga
const OPTIONS_FILE = "output/font-options.ts"; // Archivo TS generado automáticamente
const DEFAULT_FORMATS = ["woff2"]; // Formatos preferidos si no defines otros

export default {
  /**
   * Formatos que se descargarán por defecto para cada familia.
   * Puedes sobrescribirlos en cada entrada individual usando la propiedad `formats`.
   */
  formats: DEFAULT_FORMATS,

  /**
   * Listado de familias a descargar. El script solo lee `name` y `weights`,
   * pero aquí dejamos ejemplos de metadatos útiles para documentar decisiones.
   */
  fonts: [
    {
      name: "Roboto",
      weights: [100, 300, 400, 500, 700, 900],
      formats: ["woff2", "woff"],
      category: "Sans-serif versátil",
      display: "swap",
      subsetsHint: ["latin", "latin-ext"],
      recommendedPairs: ["Roboto Slab", "Merriweather"],
      comments: "Ideal para interfaces y proyectos con alto soporte lingüístico."
    },
    {
      name: "Poppins",
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      formats: ["woff2", "woff"],
      category: "Geometric sans",
      display: "swap",
      recommendedPairs: ["Playfair Display", "Roboto"],
      comments: "Buena para titulares ligeros y componentes UI con personalidad."
    },
    {
      name: "Inter",
      weights: [300, 400, 500, 600, 700],
      category: "Sans-serif para UI",
      notes: "Excelente para dashboards y productos digitales."
    },
    {
      name: "Montserrat",
      weights: [200, 300, 400, 500, 600, 700, 800, 900],
      category: "Display / Branding",
      notes: "Incluye muchas variantes, genial para landings con impacto visual."
    },
    {
      name: "Lato",
      weights: [300, 400, 700, 900],
      category: "Humanist sans",
      notes: "Perfecta para bloques de texto largos con buena legibilidad."
    },
    {
      name: "Nunito",
      weights: [200, 300, 400, 600, 700, 800],
      category: "Rounded sans",
      notes: "Aporta suavidad. Útil en productos amigables o educativos."
    },
    {
      name: "Open Sans",
      weights: [300, 400, 600, 700],
      category: "Sans-serif universal",
      notes: "Una de las más usadas. Compatible prácticamente con cualquier proyecto."
    },
    {
      name: "Manrope",
      weights: [200, 300, 400, 500, 600, 700, 800],
      category: "Modern sans",
      notes: "Su variable font ofrece mucho juego. Puedes quedarte solo con 400 y 700 si prefieres algo ligero."
    },
    {
      name: "Fira Code",
      weights: [300, 400, 500, 600, 700],
      category: "Monoespaciada",
      useCase: "Interfaces de código, snippets o paneles técnicos.",
      tips: "Recuerda que Google Fonts expone la variante 'Fira Code' como monoespaciada."
    },
    {
      name: "JetBrains Mono",
      weights: [200, 300, 400, 500, 600, 700],
      category: "Monoespaciada",
      notes: "Fantástica para editores de código, highlight de snippets, etc."
    },
    {
      name: "Playfair Display",
      weights: [400, 500, 600, 700, 800, 900],
      category: "Serif elegante",
      notes: "Combina muy bien con sans modernos como Poppins o Inter para títulos + cuerpo."
    },
    {
      name: "Merriweather",
      weights: [300, 400, 700, 900],
      category: "Serif de lectura",
      notes: "Texto largo impreso o web. Acompaña a Roboto o Open Sans como cuerpo."
    },
    {
      name: "Source Serif 4",
      weights: [300, 400, 600, 700],
      category: "Serif moderna",
      notes: "Perfecta para textos editoriales con un look moderno."
    },
    {
      name: "Raleway",
      weights: [200, 300, 400, 500, 600, 700, 800, 900],
      category: "Sans display",
      notes: "Titulares y logotipos ligeros."
    },
    {
      name: "Oswald",
      weights: [200, 300, 400, 500, 600, 700],
      category: "Condensed",
      notes: "Cuando el espacio horizontal es limitado."
    },
    {
      name: "Work Sans",
      weights: [200, 300, 400, 500, 600, 700, 800, 900],
      category: "Sans geométrica",
      notes: "Gran alternativa a Poppins con mejor legibilidad en tamaños pequeños."
    },
    {
      name: "DM Sans",
      weights: [300, 400, 500, 600, 700],
      category: "Sans amigable",
      notes: "Tipografía redondeada con excelente kerning."
    },
    {
      name: "DM Serif Display",
      weights: [400, 500, 600, 700],
      category: "Serif display",
      notes: "Combina con DM Sans para un sistema tipográfico coherente."
    },
    {
      name: "Noto Sans JP",
      weights: [300, 400, 500, 700],
      category: "Sans para japonés",
      subsetsHint: ["latin", "japanese"],
      notes: "Ejemplo de familia multilingüe con soporte extendido."
    },
    {
      name: "Noto Serif Display",
      weights: [300, 400, 500, 600, 700],
      category: "Serif internacional",
      subsetsHint: ["latin", "latin-ext"],
      notes: "Excelente para branding premium multilingüe."
    },
    {
      name: "Cabin",
      weights: [400, 500, 600, 700],
      category: "Humanist sans",
      notes: "Una alternativa a Lato con un toque más cálido."
    },
    {
      name: "Karla",
      weights: [200, 300, 400, 500, 600, 700, 800],
      category: "Grotesk",
      notes: "Una grotesca moderna pensada para UI y contenido editorial."
    },
    {
      name: "Space Grotesk",
      weights: [300, 400, 500, 600, 700],
      category: "Grotesk futurista",
      notes: "Titulares tecnológicos, páginas de producto SaaS, etc."
    },
    {
      name: "Sora",
      weights: [100, 200, 300, 400, 500, 600, 700, 800],
      category: "Sans tecnológica",
      notes: "Incluye pesos extraligeros, genial para hero sections minimalistas."
    },
    {
      name: "Bitter",
      weights: [200, 300, 400, 500, 600, 700, 800],
      category: "Serif slab",
      notes: "Excelente contraste para combinar con sans geométricas."
    },
    {
      name: "Archivo",
      weights: [200, 300, 400, 500, 600, 700],
      category: "Sans para UI",
      notes: "Diseñada para usabilidad en interfaces de alto tráfico."
    },
    {
      name: "Heebo",
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      category: "Sans israelí",
      subsetsHint: ["latin", "hebrew"],
      notes: "Soporte para hebreo con estética moderna."
    },
    {
      name: "Crimson Pro",
      weights: [200, 300, 400, 500, 600, 700, 800, 900],
      category: "Serif literaria",
      notes: "Perfecta para blogs, revistas y libros digitales."
    },
    {
      name: "IBM Plex Sans",
      weights: [100, 200, 300, 400, 500, 600, 700],
      category: "Sans corporativa",
      notes: "Incluye variantes Mono y Serif si quieres un sistema completo."
    },
    {
      name: "IBM Plex Serif",
      weights: [100, 200, 300, 400, 500, 600, 700],
      category: "Serif corporativa",
      notes: "Complementa a IBM Plex Sans para branding consistente."
    },
    {
      name: "IBM Plex Mono",
      weights: [100, 200, 300, 400, 500, 600, 700],
      category: "Monoespaciada",
      notes: "Snippet de código con tono corporativo."
    },
    {
      name: "Urbanist",
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      category: "Sans moderna",
      notes: "Gran legibilidad en interfaces densas." 
    },
    {
      name: "Sofia Sans",
      weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      category: "Sans superfamilia",
      notes: "Soporta varios scripts. Útil para proyectos internacionales."
    },
    {
      name: "Asap",
      weights: [200, 300, 400, 500, 600, 700],
      category: "Sans para UI",
      notes: "Diseñada con curvas suaves y excelente legibilidad."
    },
    {
      name: "Quicksand",
      weights: [300, 400, 500, 600, 700],
      category: "Rounded sans",
      notes: "Perfecta para proyectos educativos o apps infantiles."
    },
    {
      name: "Zilla Slab",
      weights: [300, 400, 500, 600, 700],
      category: "Slab serif",
      notes: "Creada por Mozilla, ideal para identidades tecnológicas."
    }
  ],

  /**
   * Subconjuntos por defecto solicitados a Google Fonts.
   * Puedes añadir más según tus necesidades reales.
   */
  subsets: ["latin", "latin-ext"],

  /**
   * Directorio donde se descargarán y organizarán las fuentes.
   */
  outputDir: OUTPUT_ROOT,

  /**
   * Define si queremos generar el archivo TypeScript con las opciones descargadas.
   */
  generateOptionsFile: true,

  /**
   * Ruta del archivo TypeScript a generar. Ideal para integrarlo en tu build.
   */
  optionsFilePath: OPTIONS_FILE,

};
