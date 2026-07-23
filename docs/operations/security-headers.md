# Security Headers & Content Security Policy (CSP)

## Source of Truth dos Headers
A fonte de verdade para os headers de segurança é o ficheiro `src/lib/security/securityHeaders.js` e a política de CSP em `src/lib/security/contentSecurityPolicy.js`.
Estes headers são aplicados através do proxy (`src/proxy.js`) a todas as respostas (HTML e API).

## Inventário de Origens
A CSP restringe o carregamento de recursos externos às seguintes origens necessárias:
- `'self'` - Própria aplicação.
- `https://ztxzlixcprexbhdmqpkj.supabase.co` - Armazenamento Supabase (imagens e blobs).
- `https://challenges.cloudflare.com` - Cloudflare Turnstile (formulário de contacto).
- `data:` e `blob:` - Para imagens e fontes em casos pontuais da aplicação.
- Estilos usam `'unsafe-inline'` devido ao uso extensivo de estilos inline (`style={{...}}`) no React. **Isto afeta o `style-src` mas não afeta o `script-src`.**

## CSP Final
A CSP está configurada de forma robusta e distingue ambientes:
- **Produção:**
  - Strict `script-src` usando um Nonce por request.
  - O `'unsafe-eval'` e `'unsafe-inline'` estão desativados em `script-src`.
  - Força a atualização de pedidos HTTP para HTTPS (`upgrade-insecure-requests`).
  - Bloqueio total de iframes de terceiros embebendo a nossa aplicação (`frame-ancestors 'none'`).
- **Desenvolvimento:**
  - Sem `upgrade-insecure-requests`.
  - `'unsafe-eval'` é permitido no `script-src` para o hot-module replacement funcionar localmente.

## Estratégia de Nonce
A aplicação usa a **Estratégia de Nonce por request** (Nonce de 128 bits gerado via CSPRNG em base64 no middleware proxy).
A CSP necessita de garantir que nenhum script inline não-autorizado consiga executar. Como o Next.js injeta inline scripts fundamentais, a abordagem suportada e implementada é gerar um Nonce no middleware e passá-lo para a pipeline do React via header HTTP (`x-nonce`). O Next.js encarrega-se de o incluir automaticamente no render.

## Rotas Dinâmicas e Cache
Ao usar um Nonce dinâmico por request, o HTML das rotas não pode ser guardado no cache global fixo sem transformar o Nonce (força render dinâmico do documento). 
As páginas sensíveis (ex: admin, login, tracked-links, apis autenticadas) contêm explicitamente a diretiva `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`. Os assets estáticos em `/_next/static` não sofrem este constrangimento de cache-control, pelo que continuam a ser cacheados eficazmente pelo browser e CDN.

## Headers Globais
A aplicação garante os seguintes headers globais:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=(), interest-cohort=(), fullscreen=(), display-capture=(), screen-wake-lock=()`
- `Strict-Transport-Security: max-age=31536000` (Apenas em produção)

## Exceções Justificadas e Turnstile
A integração com o Turnstile requereu adicionar as origens Cloudflare em `script-src`, `connect-src` e `frame-src`. O `style-src` usa `'unsafe-inline'` justificado pelo comportamento dos componentes atuais. A diretiva `X-Powered-By` está desativada nativamente via `next.config.mjs`.

## Processo para adicionar nova origem
Qualquer novo serviço (ex: Analytics, mapas) implica a atualização de `src/lib/security/contentSecurityPolicy.js` com justificação detalhada em Pull Request, sem esquecer os testes estáticos respetivos.

## Estratégia de Rollout
1. Validado localmente em development mode e production mode.
2. Aplicar testes permanentes (Unit e Static).
3. Gates pendentes: Configurações externas ao código continuam por verificar (ex: se Vercel sobrescreve headers). Monitorização da consola por eventuais quebras.

## Testes Obrigatórios
As verificações implementadas na diretoria `src/__tests__/security` contemplam validação unitária e análise estática (prevenção de `unsafe-inline` acidental no `script-src`, proteção das APIs, etc).

> Nota: Configuração externa (Vercel CDN, Cloudflare Edge) permanece não verificada e dependente de inspeção de produção infraestrutural.
