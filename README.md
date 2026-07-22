# Site IBVB

Site institucional da **Igreja Batista Vale das Bênçãos (IBVB)**, em Santa Cruz, Volta Redonda/RJ. O frontend público é estático e responsivo; uma API privada oferece administração de conteúdo com persistência e backups.

## Visão geral

| Rota | Arquivo | Finalidade |
| --- | --- | --- |
| `/` | `index.html` | Página institucional, cultos, mensagens, ministérios e eventos |
| `/agenda.html` | `agenda.html` | Agenda completa de cultos e eventos |
| `/admin` | `painel.html` | Painel administrativo protegido por login |
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

Depois, acesse `http://localhost:8080`. Para usar o painel, configure `ADMIN_PASSWORD` ou `ADMIN_PASSWORD_HASH` conforme [documentacao/admin.md](documentacao/admin.md).

## Edição de conteúdo

O conteúdo dinâmico está em `conteudo.json` e possui quatro grupos:

- `geral`: link da transmissão e mensagem/vídeo em destaque;
- `cultos`: dia, nome, horário e descrição dos cultos recorrentes;
- `mensagens`: até três vídeos exibidos na página inicial;
- `eventos`: agenda, descrição e telefone do responsável.

A página inicial mostra somente os três primeiros eventos; a agenda mostra todos. Os links de WhatsApp e as miniaturas do YouTube são montados no navegador. Se o JSON não puder ser carregado, o conteúdo estático existente no HTML permanece visível como fallback.

### Fluxo editorial

1. O editor acessa `/admin` e autentica com o usuário e senha configurados na VPS.
2. A API cria uma sessão segura e entrega o conteúdo atual.
3. Ao salvar, a API valida os campos, cria um backup e atualiza o volume persistente.
4. O Nginx passa a servir imediatamente o novo `conteudo.json`.
5. Os navegadores carregam a versão atualizada (cache de até 60 segundos).

Configuração, segurança, troca de senha e recuperação estão documentadas no [manual do painel](documentacao/admin.md).

## Estrutura do repositório

```text
.
├── index.html                 # página principal e lógica de apresentação
├── agenda.html                # agenda completa
├── painel.html                # interface administrativa
├── admin/                     # API, hash de senha e imagem do painel
├── conteudo.json              # conteúdo inicial do volume persistente
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

## Deploy

### Netlify

Conecte o repositório e publique a raiz, sem comando de build. O `netlify.toml` configura `/admin` e cache de 60 segundos para `conteudo.json`. O painel administrativo próprio requer a implantação Docker, pois sua API e persistência não existem em hospedagem puramente estática.

### Docker

O Compose executa o Nginx do site e a API administrativa em uma rede privada, com conteúdo em volume persistente. Em produção, coloque o site atrás de um proxy reverso com TLS e defina `SITE_HOST=127.0.0.1` quando somente o proxy local precisar acessá-lo.

## Arquitetura

A descrição técnica e os diagramas C4 em PlantUML estão em [documentacao](documentacao/README.md):

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
