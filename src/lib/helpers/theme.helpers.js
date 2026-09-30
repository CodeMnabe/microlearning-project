export const DEFAULT_THEME = Object.freeze({
  primary: "#30a9e0",
  secondary: "#191e3b",
});

export const HEX_COLOR_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export function isValidHexColor(value) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

export function normalizeHexForColorInput(value, fallback = "#000000") {
  if (!isValidHexColor(value)) return fallback;

  if (value.length === 4) {
    const [, red, green, blue] = value;
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }

  return value.toLowerCase();
}

export function getSafeTheme(theme) {
  return {
    primary: isValidHexColor(theme?.primary)
      ? theme.primary
      : DEFAULT_THEME.primary,
    secondary: isValidHexColor(theme?.secondary)
      ? theme.secondary
      : DEFAULT_THEME.secondary,
  };
}

export function applyThemeVariables(theme, root) {
  const target =
    root ?? (typeof document !== "undefined" ? document.documentElement : null);

  if (!target) return;

  const safeTheme = getSafeTheme(theme);
  target.style.setProperty("--color-primary", safeTheme.primary);
  target.style.setProperty("--color-secondary", safeTheme.secondary);
}
