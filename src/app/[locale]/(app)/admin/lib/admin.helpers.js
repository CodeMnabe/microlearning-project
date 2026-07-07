import { DEFAULT_THEME } from "./admin.constants";

/**
 * Helpers locais da área Admin.
 *
 * Este ficheiro contém funções puras usadas pela página Admin,
 * principalmente para temas, validação de cores e normalização
 * de organizações.
 *
 * Não colocar aqui estado React, hooks, JSX ou chamadas diretas à Supabase.
 */

/**
 * Valida se um valor é uma cor hexadecimal completa.
 *
 * Exemplo válido: #4f46e5
 */
export function isValidHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Garante que uma organização tem sempre tema válido para a UI.
 *
 * Se a organização não tiver tema guardado, usa as cores padrão.
 */
export function normalizeOrganizationTheme(org) {
  return {
    ...org,
    theme: {
      primary: org.theme?.primary || DEFAULT_THEME.primary,
      secondary: org.theme?.secondary || DEFAULT_THEME.secondary,
    },
  };
}

/**
 * Aplica as cores do tema às CSS variables globais.
 *
 * Isto permite que a interface reflita imediatamente o tema guardado.
 */
export function applyThemeCssVars(theme) {
  const root = document.documentElement;

  root.style.setProperty("--color-primary", theme.primary);
  root.style.setProperty("--color-secondary", theme.secondary);
}

/**
 * Atualiza localmente uma cor de tema numa lista de organizações.
 *
 * Usado para alterar a UI antes de guardar na base de dados.
 */
export function updateOrganizationThemeColor(orgs, orgId, key, value) {
  return orgs.map((org) =>
    org.id === orgId
      ? {
          ...org,
          theme: {
            ...org.theme,
            [key]: value,
          },
        }
      : org,
  );
}

/**
 * Prepara o payload usado para guardar o tema de uma organização.
 */
export function buildThemePayload(theme) {
  return {
    theme: {
      primary: theme.primary,
      secondary: theme.secondary,
    },
  };
}