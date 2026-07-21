# Site IBVB

Site institucional da **Igreja Batista Vale das Bênçãos (IBVB)**, em Santa Cruz, Volta Redonda/RJ. O projeto é uma aplicação web estática, responsiva e administrável pelo Decap CMS.

## Visão geral

| Rota | Arquivo | Finalidade |
| --- | --- | --- |
| `/` | `index.html` | Página institucional, cultos, mensagens, ministérios e eventos |
| `/agenda.html` | `agenda.html` | Agenda completa de cultos e eventos |
| `/admin` | `painel.html` | Painel editorial Decap CMS |
| `/conteudo.json` | `conteudo.json` | Fonte de dados editável do site |

Não há etapa de build: HTML, CSS e JavaScript são entregues diretamente pelo servidor. O Tailwind CSS, as fontes e as integrações são carregados por CDN.

## Executar com Docker

Pré-requisitos: Docker Engine 24+ e Docker Compose v2.

```bash
cp .env.example .env
docker compose up -d --build
```

Abra `http://localhost:8080`. O painel fica em `http://localhost:8080/admin`.

Comandos úteis:

```bash
docker compose ps
docker compose logs -f site
docker compose down
docker compose up -d --build
```

O Compose lê automaticamente o arquivo `.env` no diretório do projeto:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `site-ibvb` | Nome do projeto no Docker Compose |
| `SITE_IMAGE` | `site-ibvb:local` | Nome e tag da imagem produzida |
| `SITE_CONTAINER_NAME` | `site-ibvb` | Nome do contêiner |
| `SITE_HOST` | `127.0.0.1` | Interface que publica o site; use `0.0.0.0` para acesso pela rede |
| `SITE_PORT` | `8080` | Porta HTTP no host |
| `RESTART_POLICY` | `unless-stopped` | Política de reinício do contêiner |

Os valores têm fallback no `docker-compose.yml`, portanto o serviço também inicia sem um `.env`. Não coloque segredos nesse arquivo e não o versione.

## Desenvolvimento local

Como o site faz `fetch` de `conteudo.json`, ele deve ser servido por HTTP — abrir o HTML diretamente com `file://` pode falhar por restrições do navegador.

```bash
python3 -m http.server 8080
```

Depois, acesse `http://localhost:8080`. O painel editorial depende dos serviços da Netlify e não é integralmente reproduzido apenas pelo servidor local.

## Edição de conteúdo

O conteúdo dinâmico está em `conteudo.json` e possui quatro grupos:

- `geral`: link da transmissão e mensagem/vídeo em destaque;
- `cultos`: dia, nome, horário e descrição dos cultos recorrentes;
- `mensagens`: até três vídeos exibidos na página inicial;
- `eventos`: agenda, descrição e telefone do responsável.

A página inicial mostra somente os três primeiros eventos; a agenda mostra todos. Os links de WhatsApp e as miniaturas do YouTube são montados no navegador. Se o JSON não puder ser carregado, o conteúdo estático existente no HTML permanece visível como fallback.

### Fluxo editorial

1. O editor acessa `/admin` e autentica pelo Netlify Identity.
2. O Decap CMS usa o backend `git-gateway` e a branch `main`.
3. Ao publicar, o CMS cria um commit alterando `conteudo.json`.
4. O provedor de hospedagem publica o novo commit.
5. Os navegadores carregam a versão atualizada do JSON (cache de até 60 segundos).

Para o painel funcionar em produção, o site da Netlify deve ter **Identity** e **Git Gateway** habilitados, com usuários convidados. Em Docker, as páginas públicas funcionam normalmente, mas a publicação pelo painel continua ligada à configuração do domínio na Netlify.

## Estrutura do repositório

```text
.
├── index.html                 # página principal e lógica de apresentação
├── agenda.html                # agenda completa
├── painel.html                # configuração e interface do Decap CMS
├── conteudo.json              # conteúdo administrável
├── logo-color.png             # marca para fundos claros
├── logo-white.png             # marca para fundos escuros
├── netlify.toml               # redirects e cache na Netlify
├── Dockerfile                 # imagem Nginx do site
├── docker-compose.yml         # execução parametrizada por .env
├── nginx.conf                 # comportamento HTTP no contêiner
└── documentacao/devops/       # arquitetura e diagramas C4
```

## Integrações externas

| Serviço | Uso | Consequência sem acesso externo |
| --- | --- | --- |
| Tailwind CSS CDN | Estilos utilitários em tempo de execução | Layout perde a maior parte dos estilos |
| Google Fonts | Fraunces e Plus Jakarta Sans | Navegador usa fontes de fallback |
| YouTube | Lives, vídeos e miniaturas | Mídia externa não carrega |
| Google Maps | Mapa e rota da igreja | Mapa incorporado não carrega |
| WhatsApp | Contato de eventos e ministérios | Links externos ficam indisponíveis |
| Netlify Identity | Autenticação dos editores | Login do painel não funciona |
| Decap CMS CDN | Interface de administração | Painel editorial não inicia |

## Deploy

### Netlify

Conecte o repositório e publique a raiz, sem comando de build. O `netlify.toml` já configura `/admin` e cache de 60 segundos para `conteudo.json`. Habilite Identity e Git Gateway para edição.

### Docker

A imagem usa Nginx Alpine, expõe a porta `80` internamente e inclui healthcheck. O `nginx.conf` reproduz os redirects de `/admin` e o cache de `conteudo.json`. Em produção, coloque o contêiner atrás de um proxy reverso com TLS e defina `SITE_HOST=127.0.0.1` quando somente o proxy local precisar acessá-lo.

## Arquitetura

A descrição técnica e os diagramas C4 em PlantUML estão em [documentacao/devops](documentacao/devops/README.md):

- [Contexto do sistema](documentacao/devops/c4-contexto.puml)
- [Contêineres](documentacao/devops/c4-containers.puml)
- [Componentes do site](documentacao/devops/c4-componentes.puml)
- [Implantação](documentacao/devops/c4-deployment.puml)

## Verificações antes de publicar

```bash
docker compose config
docker compose up -d --build
curl --fail http://localhost:8080/
curl --fail http://localhost:8080/agenda.html
curl --fail http://localhost:8080/conteudo.json
curl --fail http://localhost:8080/admin
```

Confira também a navegação em telas móveis, os links externos, o JSON no painel e o estado saudável do contêiner em `docker compose ps`.

