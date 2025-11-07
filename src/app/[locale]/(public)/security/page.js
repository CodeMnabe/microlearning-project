export const metadata = {
  title: "Segurança & Fornecedores — MyDigitalBot | DIGIK",
  description:
    "Detalhes de segurança, WhatsApp Business API, OpenAI/Azure, subprocessadores, e matriz de tratamento de dados do MyDigitalBot.",
};
export const dynamic = "force-static";

export default function SecurityPage() {
  const Updated = () => (
    <p>
      <em>Última atualização: 07-11-2025</em>
    </p>
  );

  return (
    <main className="prose prose-zinc max-w-3xl px-6 py-10 mx-auto">
      <h1>Segurança & Fornecedores</h1>
      <Updated />

      <h2>WhatsApp (Business/Cloud API via MessageBird)</h2>
      <ul>
        <li>
          <strong>E2EE até aos servidores da Meta</strong> nas apps do
          utilizador; para entrega ao endpoint da empresa a mensagem é{" "}
          <strong>desencriptada no servidor</strong> e reencaminhada por{" "}
          <strong>TLS</strong> para o fornecedor (MessageBird) e para a DIGIK.
        </li>
        <li>
          <strong>Conteúdo</strong> pode ser{" "}
          <strong>processado/armazenado temporariamente</strong> para entrega,
          prevenção de abuso e requisitos legais; <strong>não</strong> é usado
          para publicidade.
        </li>
        <li>
          <strong>Metadados</strong> (números, timestamps, estados, IDs) são
          tratados para segurança e estatísticas.
        </li>
      </ul>

      <h2>OpenAI / Azure OpenAI</h2>
      <ul>
        <li>
          Em <strong>API/Enterprise/Team</strong>,{" "}
          <strong>dados não são usados para treino</strong> e não há revisão
          humana do conteúdo.
        </li>
        <li>
          <strong>Retenção operacional</strong> até <strong>30 dias</strong> (ou{" "}
          <strong>0</strong> com opções/contrato).{" "}
          <strong>Residência UE</strong> disponível em Azure OpenAI.
        </li>
      </ul>

      <h2>Subprocessadores</h2>
      <ul>
        <li>Microsoft (Teams, Azure Bot Service, Azure)</li>
        <li>Vercel (alojamento)</li>
        <li>Supabase (BD/storage, se aplicável)</li>
        <li>OpenAI / Azure OpenAI (NLP, se ativo)</li>
        <li>MessageBird (WhatsApp, se ativo)</li>
      </ul>

      <h2>Matriz de Tratamento (exemplo)</h2>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Exemplos</th>
            <th>Finalidade</th>
            <th>Base legal</th>
            <th>Retenção</th>
            <th>Subprocessadores</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Conteúdo de mensagens</td>
            <td>Texto, anexos</td>
            <td>Resposta/automação</td>
            <td>Execução de serviço (6.º/1-b)</td>
            <td>até 12 meses</td>
            <td>Microsoft, OpenAI/Azure OpenAI</td>
          </tr>
          <tr>
            <td>Metadados</td>
            <td>IDs, timestamps, estados</td>
            <td>Entrega, segurança, métricas</td>
            <td>Interesse legítimo (6.º/1-f)</td>
            <td>até 12 meses</td>
            <td>Meta/MessageBird, Microsoft, Vercel</td>
          </tr>
          <tr>
            <td>Logs técnicos</td>
            <td>IP, headers, erros</td>
            <td>Depuração e auditoria</td>
            <td>Interesse legítimo (6.º/1-f)</td>
            <td>30–90 dias</td>
            <td>Vercel, Azure</td>
          </tr>
          <tr>
            <td>Dados de conta</td>
            <td>Nome, email M365</td>
            <td>Identificação/permissões</td>
            <td>Execução de serviço (6.º/1-b)</td>
            <td>enquanto a conta estiver ativa</td>
            <td>Microsoft</td>
          </tr>
        </tbody>
      </table>

      <p>
        <strong>Nota:</strong> ajusta retenções a aquilo que implementas no teu
        backend.
      </p>

      <Updated />
    </main>
  );
}
