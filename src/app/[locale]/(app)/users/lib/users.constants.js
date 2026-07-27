import phoneCountryCodes from "../../../../../messages/phoneCountryCodes.json";

/**
 * Número máximo de tags apresentadas diretamente na linha do utilizador.
 *
 * As restantes tags são representadas através do indicador "+n".
 */
export const MAX_VISIBLE_USER_TAGS = 6;

/**
 * Chave utilizada para guardar a vista selecionada no localStorage.
 */
export const USERS_VIEW_STORAGE_KEY = "usersView";

/**
 * Vista inicial da página de utilizadores.
 */
export const DEFAULT_USERS_VIEW = "list";

/**
 * Tamanho inicial da página enviado para a API.
 */
export const DEFAULT_USERS_PAGE_SIZE = 100;

/**
 * Página inicial da listagem.
 */
export const DEFAULT_USERS_PAGE = 1;

/**
 * Código telefónico utilizado quando a organização não possui
 * um código telefónico predefinido.
 */
export const DEFAULT_PHONE_COUNTRY_CODE = "+351";

/**
 * Quantidades de utilizadores disponíveis no seletor de paginação.
 *
 * Os valores são mantidos iguais aos utilizados atualmente na página.
 */
export const USERS_PAGE_SIZE_VALUES = [50, 100, 200];

/**
 * Opções de códigos telefónicos utilizadas nos formulários
 * de criação e edição de utilizadores.
 */
export const PHONE_CODE_OPTIONS = phoneCountryCodes.map((country) => ({
  value: country.code,
  label: `${country.code} (${country.iso2})`,
}));