export default {
  code: 'pt',
  name: 'Português',
  slugs: {
    home: '',
    privacy: 'privacy',
    contact: 'contact',
    legal: 'legal',
    deletion: 'delete-account',
  },
  ui: {
    privacy: 'Privacidade',
    contact: 'Contato',
    legal: 'Aviso legal',
    privacyPolicy: 'Política de privacidade',
    deletion: 'Excluir minha conta',
    language: 'Idioma',
  },
  pages: {
    home: {
      title: 'Taleway — Aprenda inglês com histórias',
      description: 'Taleway: aprenda inglês com mini-histórias interativas, do nível A1 ao C2.',
      body: () => `
<div class="wrap">
  <section class="hero">
    <img src="/icon.png" alt="Logo do Taleway" />
    <h1>Aprenda inglês com histórias</h1>
    <p>
      Mini-histórias para ler capítulo por capítulo, do nível A1 ao C2, com narração, tradução
      das palavras e revisões inteligentes.
    </p>
    <span class="badge">Em breve no Google Play</span>
  </section>

  <section class="features">
    <div class="card">
      <h2><span class="dot" style="background: var(--violet)"></span>Histórias</h2>
      <p>Histórias no seu nível, divididas em capítulos curtos.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--sun)"></span>Uma palavra, uma tradução</h2>
      <p>Toque em uma palavra para traduzi-la: ela entra na sua lista “Minhas palavras”.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--mint)"></span>Revisões</h2>
      <p>A repetição espaçada traz as palavras de volta no momento certo.</p>
    </div>
    <div class="card">
      <h2><span class="dot" style="background: var(--coral)"></span>Uma meta diária</h2>
      <p>Alguns minutos por dia e uma sequência para manter.</p>
    </div>
  </section>
</div>`,
    },

    privacy: {
      title: 'Política de privacidade — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Política de privacidade</h1>
  <p class="updated">Última atualização: 29 de outubro de 2026</p>

  <p>
    Esta política explica quais dados o aplicativo Taleway (“o aplicativo”) coleta, por quê, e
    quais são os seus direitos.
  </p>

  <h2>Controlador dos dados</h2>
  <p>
    ${c.name}, empresário individual (França), SIRET ${c.siret}, ${c.address}, França.<br />
    Contato: <a href="mailto:${c.email}">${c.email}</a>
  </p>

  <h2>Dados coletados</h2>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Dado</th>
          <th>Por quê</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Endereço de e-mail e senha (armazenada criptografada)</td>
          <td>Criar sua conta, fazer seu login, redefinir sua senha</td>
        </tr>
        <tr>
          <td>Nome de usuário</td>
          <td>Identificar você no aplicativo</td>
        </tr>
        <tr>
          <td>Idioma escolhido e meta diária</td>
          <td>Mostrar a interface e as traduções no seu idioma, acompanhar sua meta</td>
        </tr>
        <tr>
          <td>Progresso de leitura (histórias, capítulos, páginas)</td>
          <td>Retomar a leitura de onde você parou</td>
        </tr>
        <tr>
          <td>Palavras consultadas e resultados das revisões</td>
          <td>Montar sua lista “Minhas palavras” e programar suas revisões</td>
        </tr>
        <tr>
          <td>Tempo de prática, sequências e pontos</td>
          <td>Calcular sua meta do dia e sua sequência</td>
        </tr>
        <tr>
          <td>Assinatura premium (plano, status, data de vencimento, histórico de compras)</td>
          <td>Liberar o conteúdo premium na sua conta, em todos os seus dispositivos</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>Os pagamentos são processados pelo Google Play: nunca temos acesso aos seus dados bancários.</p>
  <p>
    Base legal: a execução do serviço que você solicita ao criar uma conta ou assinar (artigo
    6.1.b do RGPD; artigo 7, V, da LGPD).
  </p>

  <h2>O que não fazemos</h2>
  <ul>
    <li>Sem publicidade, sem rastreadores de anúncios.</li>
    <li>Sem ferramentas de análise de terceiros.</li>
    <li>Não vendemos nem compartilhamos seus dados para fins comerciais.</li>
    <li>Sem acesso ao microfone, à câmera, aos contatos nem à sua localização.</li>
  </ul>

  <h2>Operadores</h2>
  <ul>
    <li><strong>Supabase</strong>: hospedagem do banco de dados e autenticação.</li>
    <li>
      <strong>RevenueCat</strong> (Estados Unidos): gestão das assinaturas. Recebe o
      identificador técnico da sua conta e o seu histórico de compras, nunca o seu e-mail nem os
      seus dados de leitura.
    </li>
    <li>
      <strong>Google Play</strong>: pagamento das assinaturas, segundo a
      <a href="https://policies.google.com/privacy">política de privacidade do Google</a>.
    </li>
  </ul>
  <p>
    Alguns dados podem ser transferidos para fora da União Europeia; essas transferências são
    amparadas pelas cláusulas contratuais padrão da Comissão Europeia.
  </p>

  <h2>Prazo de conservação</h2>
  <p>
    Seus dados são mantidos enquanto sua conta existir. Quando a conta é excluída, eles são
    apagados em no máximo 30 dias. O Google Play e a RevenueCat podem manter o histórico de
    compras por mais tempo para cumprir suas obrigações contábeis e legais.
  </p>

  <h2>Seus direitos</h2>
  <p>
    Você pode acessar seus dados, corrigi-los, apagá-los, se opor ao tratamento ou solicitar a
    portabilidade escrevendo para <a href="mailto:${c.email}">${c.email}</a>. Para excluir sua
    conta, veja <a href="${u.deletion}">esta página</a>. Você também pode apresentar uma
    reclamação à autoridade de proteção de dados, como a ANPD no Brasil
    (<a href="https://www.gov.br/anpd">gov.br/anpd</a>), a CNPD em Portugal
    (<a href="https://www.cnpd.pt">cnpd.pt</a>) ou a CNIL na França
    (<a href="https://www.cnil.fr">cnil.fr</a>).
  </p>

  <h2>Segurança</h2>
  <p>
    As comunicações entre o aplicativo e nossos servidores são criptografadas (HTTPS). Cada
    usuário só pode acessar os dados da própria conta.
  </p>

  <h2>Alterações</h2>
  <p>
    Esta política pode mudar. A data no topo da página indica a versão mais recente. Em caso de
    divergência entre as traduções, prevalece a <a href="/confidentialite">versão em francês</a>.
  </p>
</article>`,
    },

    contact: {
      title: 'Contato — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Contato</h1>
  <p>Uma dúvida, um bug, uma ideia de história? Escreva para nós:</p>
  <p>
    E-mail: <a href="mailto:${c.email}">${c.email}</a>
  </p>
  <p>
    ${c.name}, empresário individual<br />
    SIRET: ${c.siret}<br />
    ${c.address}, França
  </p>
</article>`,
    },

    legal: {
      title: 'Aviso legal — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Aviso legal</h1>

  <h2>Editor</h2>
  <p>
    ${c.name}, empresário individual (microempresa francesa)<br />
    SIRET: ${c.siret}<br />
    Endereço: ${c.address}, França<br />
    E-mail: <a href="mailto:${c.email}">${c.email}</a><br />
    Diretor da publicação: ${c.name}
  </p>

  <h2>Hospedagem</h2>
  <p>
    Vercel Inc.<br />
    440 N Barranca Ave #4133, Covina, CA 91723, Estados Unidos<br />
    <a href="https://vercel.com">vercel.com</a>
  </p>

  <h2>Propriedade intelectual</h2>
  <p>
    Os conteúdos deste site e do aplicativo Taleway (textos, histórias, ilustrações, gravações
    de áudio, logotipo) são protegidos. É proibida qualquer reprodução sem autorização.
  </p>

  <h2>Dados pessoais</h2>
  <p>Veja a <a href="${u.privacy}">política de privacidade</a>.</p>
</article>`,
    },

    deletion: {
      title: 'Excluir minha conta — Taleway',
      body: (u, c) => `
<article class="wrap doc">
  <h1>Excluir minha conta Taleway</h1>

  <h2>Pelo aplicativo</h2>
  <ol>
    <li>Abra o Taleway e vá até a aba <strong>Perfil</strong>.</li>
    <li>Toque em <strong>Excluir minha conta</strong> na parte de baixo da tela.</li>
    <li>Confirme: sua conta e seus dados são apagados imediatamente.</li>
  </ol>

  <h2>Por e-mail</h2>
  <p>Se você não tem mais acesso ao aplicativo:</p>
  <ol>
    <li>
      Envie um e-mail para <a href="mailto:${c.email}?subject=Exclus%C3%A3o%20da%20minha%20conta%20Taleway">${c.email}</a>
      com o assunto “Exclusão da minha conta Taleway”.
    </li>
    <li>Envie a partir do endereço de e-mail da sua conta Taleway (ou informe-o na mensagem).</li>
    <li>Você receberá uma confirmação assim que a exclusão for feita.</li>
  </ol>

  <h2>Assinatura</h2>
  <p>
    Excluir sua conta não cancela uma assinatura ativa: cancele-a antes no Google Play
    (<strong>Pagamentos e assinaturas → Assinaturas</strong>).
  </p>

  <h2>Dados excluídos</h2>
  <p>Todos os dados ligados à sua conta são apagados definitivamente:</p>
  <ul>
    <li>endereço de e-mail, senha e nome de usuário;</li>
    <li>idioma e meta diária;</li>
    <li>progresso de leitura;</li>
    <li>lista “Minhas palavras” e histórico de revisões;</li>
    <li>tempo de prática, sequências e pontos;</li>
    <li>status da sua assinatura.</li>
  </ul>
  <p>
    O Google Play e a RevenueCat podem manter o histórico de compras para cumprir suas obrigações
    contábeis e legais.
  </p>

  <h2>Prazo</h2>
  <p>Pelo aplicativo, a exclusão é imediata. Por e-mail, é feita em no máximo 30 dias. Depois disso, nenhum outro dado é mantido.</p>
</article>`,
    },
  },
};
