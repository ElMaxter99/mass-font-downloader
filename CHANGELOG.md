# Changelog

Todas las novedades relevantes de `mass-font-downloader` se documentarán en este archivo.

## [Unreleased]
### Añadido
- Personalización avanzada de nombres de archivo mediante `fileNameOptions`, incluyendo mapeo de pesos numéricos a etiquetas (`Regular`, `Bold`, etc.).
- Nuevas pruebas que cubren la estrategia de renombrado configurable.
- Interpretación de alias textuales de peso (`regular`, `medium`, `semibold`, `bold`, `black`, etc.) tanto en la configuración como en la CLI, incluido el modo `--all`.

## [1.0.2] - 2025-10-29
### Añadido
- Fix Integración de para subir a NPM

## [1.0.1] - 2025-10-29
### Añadido
- Integración de para subir a NPM

## [1.0.0] - 2025-10-29
### Añadido
- CLI `mass-fonts` para descargas ad hoc con soporte de banderas para subconjuntos, formatos, generación opcional de `font-options.ts`, descarga de todas las variantes y modo depuración. 
- Script principal `scripts/download-fonts.js` que carga `config/fonts.config.js`, descarga y organiza fuentes por carpeta, reutiliza descargas existentes y genera el archivo `FONT_OPTIONS` cuando se solicita.
- Utilidades en `lib/font-utils.js` para normalizar formatos, seleccionar alternativas compatibles, parsear CSS de Google Fonts, construir consultas con todos los ejes disponibles y resumir variantes descargadas.
- Logger configurable en `lib/debug.js` que habilita trazas detalladas tanto en el script como en la CLI mediante `--debug` o la variable `MASS_FONTS_DEBUG`.
- Conjunto de pruebas (`node --test`) que cubre la normalización de formatos, el parseo de CSS, la resolución de variantes y la generación de nombres de archivo.
