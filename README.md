# Mass Font Downloader

Script/CLI en Node.js para descargar masivamente fuentes de Google Fonts, renombrarlas por tipografía y peso, y (opcionalmente) generar un archivo `font-options.ts` listo para importar en tus proyectos.

## 🚀 Características

- Descarga múltiples familias y pesos de Google Fonts en una sola ejecución.
- Renombra automáticamente los archivos siguiendo el patrón `<familia>-<peso>.ttf`.
- Guarda cada familia en su propia carpeta dentro de un directorio de salida.
- Genera (opcionalmente) un archivo TypeScript con las fuentes descargadas, útil para selectores o componentes dinámicos.
- Se puede usar tanto mediante un script configurado por archivo (`config/fonts.config.js`) como con la CLI `mass-fonts`.

## 📦 Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior (el proyecto usa módulos ES).
- Acceso a internet para consultar Google Fonts y descargar los archivos `.ttf`.

## 🛠 Instalación

```bash
# Instala las dependencias
npm install
```

## ⚙️ Configuración por archivo (`scripts/download-fonts.js`)

1. Edita `config/fonts.config.js` para definir:
   - `fonts`: lista de familias y pesos a descargar.
   - `subsets`: subconjuntos de caracteres (por defecto `latin`).
   - `outputDir`: carpeta de salida donde se guardarán las fuentes.
   - `generateOptionsFile`: `true` para generar `font-options.ts`.
   - `optionsFilePath`: ruta donde se escribirá ese archivo TypeScript.

   ```js
   export default {
     fonts: [
       { name: "Roboto", weights: [400, 700] },
       { name: "Poppins", weights: [400, 600, 700] }
     ],
     subsets: ["latin"],
     outputDir: "output/fonts",
     generateOptionsFile: true,
     optionsFilePath: "output/font-options.ts"
   };
   ```

2. Ejecuta el script:

   ```bash
   npm run download
   # o
   npm start
   ```

El script descargará las fuentes y, si está activado, generará el archivo `font-options.ts` con un export `FONT_OPTIONS`.

## 🧰 Uso de la CLI (`bin/mass-fonts.js`)

La CLI permite lanzar descargas ad hoc sin tocar la configuración.

```bash
# Opción 1: usando npm (recomendado durante el desarrollo)
npm run cli -- --fonts "Roboto:400,700;Poppins:400" --output "output/fonts" --ts "output/font-options.ts" --subset latin

# Opción 2: usando npx directamente
npx mass-fonts --fonts "Inter:400,500,700" --output "output/fonts" --subset latin-ext
```

### Parámetros disponibles

| Opción | Descripción | Valor por defecto |
| --- | --- | --- |
| `-f, --fonts <fonts>` | Familias y pesos separados por `;` y `,` (ej. `"Roboto:400,700;Poppins:400"`). **Obligatorio.** | — |
| `-o, --output <dir>` | Carpeta de salida raíz. | `output/fonts` |
| `--ts <file>` | Ruta del archivo `font-options.ts` a generar. | no genera archivo |
| `--subset <subset>` | Subconjunto de caracteres (`latin`, `latin-ext`, `cyrillic`, etc.). | `latin` |

> **Nota:** Cada familia se almacenará dentro de una subcarpeta con el nombre en minúsculas y espacios reemplazados por guiones (`poppins`, `open-sans`, etc.).

## 📁 Estructura de salida

Después de ejecutar una descarga, el directorio de salida tendrá este aspecto:

```
output/
└── fonts/
    ├── roboto/
    │   ├── roboto-400.ttf
    │   └── roboto-700.ttf
    └── poppins/
        ├── poppins-400.ttf
        ├── poppins-600.ttf
        └── poppins-700.ttf
```

Si activaste la generación del archivo TypeScript, se creará también:

```ts
// ⚡️ Generated automatically by mass-font-downloader
export const FONT_OPTIONS = [
  {
    "name": "Roboto",
    "folder": "roboto",
    "files": ["roboto-400.ttf", "roboto-700.ttf"]
  },
  {
    "name": "Poppins",
    "folder": "poppins",
    "files": ["poppins-400.ttf", "poppins-600.ttf", "poppins-700.ttf"]
  }
];
```

## 🔧 Personalización adicional

- **Añadir más subconjuntos:** Agrega valores en `subsets` (ej. `['latin', 'latin-ext']`).
- **Cambiar formato de archivo:** Por defecto solo se guardan `.ttf`. Si necesitas `woff`/`woff2`, modifica la validación `if (format !== "truetype") continue;` en los scripts.
- **Evitar la generación de TypeScript:** Pon `generateOptionsFile: false` en la configuración o no pases `--ts` en la CLI.

## 🧪 Consejos y resolución de problemas

- **No se descargan fuentes:** verifica que la familia exista en Google Fonts y que los pesos solicitados estén disponibles.
- **Errores de red (`403` o `404`):** Google Fonts requiere un `User-Agent` válido; el script ya envía uno, pero asegúrate de que tu red no bloquee las solicitudes.
- **Duplicados:** si una fuente ya existe, no se vuelve a descargar; simplemente se reutiliza el archivo existente.
- **Carpetas vacías:** si una familia no devuelve URLs válidas, se mostrará una advertencia y no se crearán archivos.

## 🤖 Integración en flujos automatizados

- Invoca el script desde npm (`npm run download`) dentro de tu pipeline (GitHub Actions, GitLab CI, etc.).
- Usa la CLI con los parámetros que necesites, por ejemplo:
  ```bash
  npx mass-fonts --fonts "Inter:400,500" --output "build/fonts" --subset latin --ts "src/font-options.ts"
  ```
- Si deseas usar la lógica desde otro archivo Node.js, puedes copiar/adaptar la función `downloadFonts` que se define en `scripts/download-fonts.js` o refactorizarla para exportarla según tus necesidades.

## 📄 Licencia de las fuentes

Este proyecto solo automatiza la descarga de los archivos hospedados en Google Fonts. Revisa las licencias de cada familia antes de distribuirlas o usarlas en proyectos comerciales.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Abre un issue o PR con mejoras, correcciones o nuevas características. Crea un issue para seguir mejorando esta herramienta.

## 📝 Licencia
MIT © 2025 AlvaroMaxter
