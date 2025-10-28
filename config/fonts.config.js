export default {
  fonts: [
    { name: "Roboto", weights: [400, 700] },
    { name: "Poppins", weights: [400, 600, 700] },
    { name: "Inter", weights: [400, 500, 700] },
    { name: "Lato", weights: [400, 700] },
    { name: "Montserrat", weights: [400, 700] },
    { name: "Manrope", weights: [400, 700] }
  ],
  subsets: ["latin"], // puedes agregar 'latin-ext', 'cyrillic', etc.
  outputDir: "output/fonts",
  generateOptionsFile: true,
  optionsFilePath: "output/font-options.ts"
};
