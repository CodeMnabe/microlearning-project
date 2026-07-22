# Política operacional de logging

## Objetivo e âmbito

Esta política aplica-se aos logs server-side controlados pela aplicação. O logger central em `src/lib/observability/logger.js` é o único ponto autorizado para emitir eventos de produção. Logs do browser, ferramentas locais e testes não são fontes de observabilidade de produção e devem ser avaliados separadamente.

A existência desta política no repositório não confirma a configuração da plataforma onde os logs são armazenados. Retenção, controlo de acesso, exportações e eliminação efetiva têm de ser verificados no ambiente de operação.

## Dados proibidos

Os logs não podem conter:

- nomes, telefones, endereços de email ou outros identificadores pessoais;
- mensagens, conteúdo gerado pelo utilizador, parâmetros de templates ou ficheiros;
- request/response bodies, payloads de webhooks, activities ou objetos arbitrários;
- headers, cookies, sessões, assinaturas, JWTs, tokens, secrets ou API keys;
- URLs completas, signed URLs, tracked URLs, service URLs ou object paths;
- idempotency keys, reservation keys ou claim tokens;
- IDs externos de fornecedores, contactos, conversas, tenants ou canais;
- respostas completas de Supabase, OpenAI, Bird, Teams ou outros fornecedores;
- `Error.message`, `Error.stack`, `cause`, configuração de clientes HTTP ou respostas anexadas ao erro.

## Eventos e campos permitidos

O nome do evento tem de ser um identificador funcional, estático, em `snake_case` e existir no registo finito `EVENT_SCHEMAS`. Não pode ser construído com input do utilizador. Eventos desconhecidos são rejeitados sem emissão e sem lançar uma exceção.

Cada evento publica campos através do seu schema próprio em `EVENT_SCHEMAS`. Cada schema define os campos permitidos e os respetivos enums ou tipos. Os campos disponíveis incluem apenas:

- classificação operacional: `provider`, `operation`, `outcome`, `status`, `statusCode`, `channel`, `resourceType` e `phase`;
- métricas: `durationMs`, `attempt`, `count`, `batchSize`, contagens de outcomes e `retryable`;
- classificação de erro: `errorType` e `errorCode`;
- IDs internos estritamente necessários: `organizationId`, `assistantId`, `broadcastId`, `chainId`, `runId`, `fileId`, `reservationId`, `userId`, `deliveryId` e `pendingOutreachId`.

Campos desconhecidos ou com tipo, enum ou formato inválido são descartados. Campos operacionais textuais aceitam apenas enums finitos; IDs aceitam apenas inteiros positivos ou UUIDs, conforme o recurso; contadores aceitam apenas números inteiros primitivos e não negativos. Não existem campos genéricos para arrays ou objetos nested. Não é permitido fazer spread de request bodies, payloads, responses ou objetos de integração num evento.

## Níveis

- `debug`: diagnóstico temporário durante desenvolvimento local; não deve ser ativado em produção sem aprovação e prazo de remoção.
- `info`: início ou conclusão de uma operação esperada e resumos de batch.
- `warn`: input rejeitado, recurso não encontrado ou outcome degradado que não interrompe o processo.
- `error`: falha operacional que requer investigação, retry ou intervenção.

O nível não altera as regras de dados proibidos.

## Tratamento de erros

Os callers podem entregar o objeto de erro num argumento separado. O logger consulta apenas data descriptors próprios e primitivos de objetos com prototype suportado, sem invocar accessors ou coerções. Valores conhecidos são mapeados para classificações internas finitas; valores desconhecidos produzem apenas `unknown_error`. Mensagem, stack, cause, headers, bodies e configuração do cliente não são lidos nem serializados.

Mensagens livres não são uma alternativa a códigos técnicos. Quando for necessária uma explicação estável, deve ser representada por um nome de evento, operação ou outcome estático.

## Ambientes e limites

- Produção emite uma linha JSON por evento e inclui timestamp.
- Testes produzem JSON determinístico e capturável, sem timestamp por omissão.
- Desenvolvimento aplica a mesma allowlist e redaction; maior legibilidade nunca autoriza PII, credentials ou conteúdo.

O logger não aceita strings operacionais livres, arrays ou objetos nested. Enums têm cardinalidade finita, UUIDs têm formato fixo, IDs numéricos são inteiros positivos e contadores são inteiros não negativos. Proxies, accessors e prototypes inesperados são rejeitados. Toda a validação, classificação, serialização e emissão está protegida por uma barreira non-throwing, pelo que uma falha de logging não pode interromper o fluxo funcional.

## Retenção, acesso e exportação

- Retenção recomendada por omissão: no máximo 30 dias para logs operacionais.
- Uma retenção até 90 dias exige necessidade documentada, aprovação do responsável de segurança e confirmação de que os eventos continuam sem dados proibidos.
- O acesso deve seguir menor privilégio, com grupos separados para operação e administração e revisão periódica de membros.
- Logs não podem ser exportados para ferramentas, contas, regiões ou destinos que não tenham aprovação explícita.
- A configuração efetiva de RBAC, retenção, região e integrações de observabilidade deve ser revista antes de cada entrada em produção e após alterações de plataforma.

## Revisão

Alterações que adicionem ou modifiquem logs server-side têm de:

1. usar o logger central;
2. usar um evento funcional estático;
3. passar os testes de sentinelas e a verificação estática;
4. demonstrar que o evento conserva apenas a informação necessária para operação;
5. receber revisão específica quando adicionar um campo à allowlist.

## Resposta a dados sensíveis em logs

Quando for detetado um segredo ou dado pessoal num log:

1. interromper exportações e restringir imediatamente o acesso ao conjunto afetado;
2. identificar o período, destinos e pessoas com acesso sem copiar o valor sensível para novos tickets ou logs;
3. corrigir o ponto de emissão e adicionar um teste de regressão com sentinela falsa;
4. rodar ou revogar credentials, tokens, URLs com capacidade de acesso e sessões potencialmente expostas;
5. eliminar ou reduzir a retenção dos registos afetados em todos os destinos aprovados, conforme as capacidades e obrigações aplicáveis;
6. documentar a confirmação de eliminação, as limitações da plataforma e qualquer cópia que não possa ser removida.

## Gates externos

Antes de considerar a operação validada, é obrigatório confirmar fora do repositório:

- retenção efetiva configurada na plataforma;
- RBAC efetivo e revisão dos utilizadores com acesso;
- integrações e destinos de observabilidade ativos;
- eliminação dos logs históricos sensíveis e rotação de qualquer segredo exposto.

Estes gates estão deliberadamente marcados como não verificados até existir evidência da plataforma. O código e esta política, por si só, não os satisfazem.
