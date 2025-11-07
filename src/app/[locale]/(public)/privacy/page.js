export const metadata = {
  title: "Política de Privacidade — MyDigitalBot | DIGIK",
  description:
    "Como a DIGIK trata dados pessoais no MyDigitalBot (Teams/WhatsApp/OpenAI), base legal, retenções, subprocessadores, direitos RGPD e contactos.",
};
export const dynamic = "force-static";

export default function PrivacyPage() {
  const Updated = () => (
    <p>
      <em>Última atualização: 07-11-2025</em>
    </p>
  );

  return (
    <main className="prose prose-zinc max-w-3xl px-6 py-10 mx-auto">
      <h1>Política de Privacidade</h1>
      <Updated />

      <h2>1) Quem somos</h2>
      <p>
        <strong>DIGIK</strong> (“nós”) desenvolve o{" "}
        <strong>MyDigitalBot</strong>, um assistente integrado no Microsoft
        Teams (e, opcionalmente, WhatsApp).
        <br />
        Contacto: <a href="mailto:privacy@digik.pt">privacy@digik.pt</a> • Sede:
        [morada]
      </p>

      <h2>2) Que dados tratamos</h2>
      <ul>
        <li>
          <strong>Conteúdo das mensagens</strong> trocadas com o bot (texto,
          imagens, vídeos, documentos).
        </li>
        <li>
          <strong>Metadados</strong>: IDs de utilizador/tenant/conversa/canal,
          timestamps, estados de entrega, endereços IP.
        </li>
        <li>
          <strong>Dados de conta</strong> do Microsoft 365 (nome, email) quando
          fornecidos pelo Teams.
        </li>
        <li>
          <strong>Logs técnicos</strong>: erros e eventos do sistema.
        </li>
        <li>
          <strong>(Opcional WhatsApp)</strong> número de telemóvel e mensagens
          via WhatsApp Business API.
        </li>
      </ul>

      <h2>3) Finalidades</h2>
      <ul>
        <li>
          Operar o bot e <strong>responder</strong> às mensagens.
        </li>
        <li>
          Envio de <strong>mensagens proativas</strong> (campanhas/alertas)
          configuradas pela sua organização.
        </li>
        <li>
          <strong>Melhoria</strong> do serviço, monitorização e prevenção de
          abuso.
        </li>
        <li>
          Cumprimento de <strong>obrigações legais</strong>.
        </li>
      </ul>

      <h2>4) Bases legais (RGPD)</h2>
      <ul>
        <li>
          <strong>Execução de contrato/serviço</strong> com a sua organização
          (art. 6.º/1-b).
        </li>
        <li>
          <strong>Interesse legítimo</strong> na segurança e melhoria (art.
          6.º/1-f).
        </li>
        <li>
          <strong>Consentimento</strong> quando exigido para funcionalidades
          opcionais (art. 6.º/1-a).
        </li>
      </ul>

      <h2>5) Subprocessadores e transferências</h2>
      <p>Usamos fornecedores que atuam por nossa conta:</p>
      <ul>
        <li>
          <strong>Microsoft</strong> (Azure/Teams, Azure Bot Service) — entrega
          e alojamento.
        </li>
        <li>
          <strong>Vercel</strong> — alojamento da aplicação web/API.
        </li>
        <li>
          <strong>Supabase</strong> — base de dados/armazenamento (se
          aplicável).
        </li>
        <li>
          <strong>OpenAI / Azure OpenAI</strong> — processamento de linguagem
          natural (se ativo).
        </li>
        <li>
          <strong>MessageBird</strong> — gateway WhatsApp (se ativado).
        </li>
      </ul>
      <p>
        Alguns localizam-se fora do EEE; aplicamos{" "}
        <em>Cláusulas Contratuais-Tipo</em> e outras salvaguardas.
      </p>

      <h2>6) Conservação</h2>
      <ul>
        <li>
          <strong>Mensagens e metadados</strong>: até <strong>12 meses</strong>{" "}
          (configurável por cliente).
        </li>
        <li>
          <strong>Referências de conversa</strong> para mensagens proativas: até{" "}
          <strong>12 meses</strong> após a última interação.
        </li>
        <li>
          <strong>Logs técnicos</strong>: <strong>30–90 dias</strong>.
        </li>
      </ul>
      <p>
        Quando deixam de ser necessários, os dados são{" "}
        <strong>eliminados ou anonimizados</strong>.
      </p>

      <h2>7) Segurança</h2>
      <p>
        Encriptação em trânsito (TLS), encriptação em repouso nos fornecedores,
        controlo de acessos, registo de atividade e backups. Nenhum método é
        100% infalível.
      </p>

      <h2>8) Direitos dos titulares</h2>
      <p>
        Tem direito a <strong>acesso</strong>, <strong>retificação</strong>,{" "}
        <strong>apagamento</strong>, <strong>limitação</strong>,{" "}
        <strong>portabilidade</strong> e <strong>oposição</strong> junto da sua
        organização ou da DIGIK:{" "}
        <a href="mailto:privacy@digik.pt">privacy@digik.pt</a>. Reclamações:{" "}
        <a href="https://www.cnpd.pt/">CNPD</a>.
      </p>

      <h2>9) Controlador e responsabilidades</h2>
      <p>
        Quando fornecido à sua <strong>organização</strong>, esta atua como{" "}
        <strong>responsável pelo tratamento</strong>; a DIGIK atua como{" "}
        <strong>subcontratante</strong> (processor). Em contextos
        DIGIK-as-a-service, a DIGIK pode atuar como responsável.
      </p>

      <h2>10) Alterações</h2>
      <p>
        Podemos atualizar esta política. A versão vigente permanece nesta
        página.
      </p>

      <Updated />
    </main>
  );
}
