export const VesperColors = {
  // Sage (Primary heritage brand)
  sage: {
    50: "#f3f7f4",
    100: "#e3ece6",
    200: "#c8dad0",
    300: "#a3c0af",
    400: "#79a18a",
    500: "#5a846c",
    600: "#446954", // primary brand sage
    700: "#375443",
    800: "#2d4437",
    900: "#26392f",
  },
  // Sand (Warm resort ivory canvas & surfaces)
  sand: {
    50: "#faf8f5", // canvas background
    100: "#f4efe6", // subtle card surface
    200: "#e8ded0", // borders
    300: "#d7c5ae",
    400: "#c2a88b",
    500: "#ad8e6d",
    600: "#987556",
    700: "#7d5d44",
    800: "#674d3b",
    900: "#554032",
  },
  // Gold (Refined luxury accents)
  gold: {
    50: "#faf7ec",
    100: "#f3ecce",
    200: "#ebd99f",
    300: "#e1c269",
    400: "#d6ad3d",
    500: "#c59a2a", // metallic gold
    600: "#aa7e20",
    700: "#865e1c",
  },
  // Status Colors (Light theme)
  status: {
    ready: { bg: "#e8f5e9", text: "#1b5e20", border: "#a5d6a7" },
    cleaning: { bg: "#fff8e1", text: "#b26a00", border: "#ffe082" },
    dirty: { bg: "#ffebee", text: "#c62828", border: "#ef9a9a" },
    urgent: { bg: "#fff3e0", text: "#e65100", border: "#ffcc80" },
  },
} as const;

export const VesperFonts = {
  serif: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;
