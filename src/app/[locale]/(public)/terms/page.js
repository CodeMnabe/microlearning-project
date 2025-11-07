import Link from "next/link";

export const metadata = {
  title: "Termos de Utilização — MyDigitalBot | DIGIK",
  description:
    "Termos de utilização do MyDigitalBot para Microsoft Teams (uso aceitável, disponibilidade, responsabilidade, lei aplicável).",
};
export const dynamic = "force-static";

export default function TermsPage() {
  const Updated = () => (
    <p>
      <em>Última atualização: 07-11-2025</em>
    </p>
  );

  return (
    <main className="prose prose-zinc max-w-3xl px-6 py-10 mx-auto">
      <h1>Termos de Utilização</h1>
      <Updated />

      <ol>
        <li>
          <strong>Objeto.</strong> Estes Termos regulam a utilização do{" "}
          <strong>MyDigitalBot</strong> no Microsoft Teams.
        </li>
        <li>
          <strong>Acesso.</strong> O acesso é fornecido à sua organização e
          depende das políticas internas e de licenças Microsoft 365.
        </li>
        <li>
          <strong>Uso aceitável.</strong> É proibido conteúdo ilegal/ofensivo,
          spam, engenharia reversa, exploração de falhas ou violação de direitos
          de terceiros.
        </li>
        <li>
          <strong>Conteúdos.</strong> É responsável pelo conteúdo que envia.
          Concede-nos licença limitada para processar as mensagens apenas para
          operar e melhorar o serviço.
        </li>
        <li>
          <strong>Mensagens proativas.</strong> O bot pode enviar
          notificações/campanhas configuradas pela sua organização. Pode
          desinstalar a app ou solicitar exclusão.
        </li>
        <li>
          <strong>Disponibilidade.</strong> Serviço “tal como está”, podendo
          ocorrer interrupções por manutenção, falhas ou motivos alheios ao
          nosso controlo.
        </li>
        <li>
          <strong>Limitação de responsabilidade.</strong> Na máxima medida
          legal, excluímos responsabilidade por danos indiretos, especiais,
          exemplares ou lucros cessantes.
        </li>
        <li>
          <strong>Privacidade.</strong> Consulte a{" "}
          <Link href="/privacy">Política de Privacidade</Link>.
        </li>
        <li>
          <strong>Alterações.</strong> Podemos rever estes Termos e indicaremos
          a data de atualização nesta página.
        </li>
        <li>
          <strong>Lei e foro.</strong> Lei portuguesa; foro da comarca de
          [cidade].
        </li>
        <li>
          <strong>Contactos.</strong>{" "}
          <a href="mailto:geral@digik.pt">geral@digik.pt</a>
        </li>
      </ol>

      <Updated />
    </main>
  );
}
