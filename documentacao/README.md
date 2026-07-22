# Arquitetura e operação

Esta pasta registra a arquitetura do site IBVB no modelo C4 e os detalhes relevantes para operação.

## Diagramas

| Nível | Arquivo | Questão respondida |
| --- | --- | --- |
| C4 — Contexto | `c4-contexto.puml` | Quem usa o sistema e com quais sistemas ele se integra? |
| C4 — Contêineres | `c4-containers.puml` | Quais unidades executáveis e fontes de dados compõem a solução? |
| C4 — Componentes | `c4-componentes.puml` | Como as páginas e scripts do site se dividem? |
| C4 — Deployment | `c4-deployment.puml` | Como a solução é implantada na Netlify e em Docker? |

Os arquivos usam [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) por include remoto. Para renderizar, instale PlantUML e Graphviz e permita acesso ao GitHub:

```bash
plantuml documentacao/devops/*.puml
```

Também é possível usar uma extensão PlantUML no editor. A saída padrão é PNG ao lado de cada fonte; esses arquivos gerados não são necessários para executar o site. 

Sugestão de extensão: 
 - PlantUML  https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml
 - PlantUML Previewer https://marketplace.visualstudio.com/items?itemName=Mebrahtom.plantumlpreviewer

## Decisões arquiteturais

- **Site estático:** reduz operação e elimina servidor de aplicação e banco de dados.
- **JSON como conteúdo:** `conteudo.json` separa as alterações editoriais da estrutura das páginas.
- **Painel próprio:** uma API interna autentica editores e persiste o conteúdo sem depender da Netlify.
- **Volume persistente:** conteúdo, backups e auditoria sobrevivem à substituição dos contêineres.
- **Dependências por CDN:** simplifica o projeto, mas requer internet no navegador e torna disponibilidade, versão e privacidade dependentes de terceiros.
- **Fallback no HTML:** páginas continuam exibindo conteúdo básico se o JSON estiver indisponível.
- **Nginx no Docker:** entrega os mesmos artefatos estáticos e replica as rotas e headers relevantes da Netlify.

## Fluxos principais

### Leitura pública

1. O navegador solicita uma página ao host Netlify ou Nginx.
2. O HTML carrega Tailwind, fontes e recursos externos.
3. JavaScript solicita `conteudo.json` com cache-busting na query string.
4. O DOM é preenchido com cultos, mensagens e eventos.
5. Imagens, mapas, vídeos e contatos apontam para serviços externos.

### Publicação editorial

1. O editor abre `/admin` e informa suas credenciais.
2. A API valida o hash da senha e cria uma sessão protegida por cookie e CSRF.
3. O painel lê e edita o JSON pela API interna.
4. A API valida, cria backup e grava `conteudo.json` de forma atômica.
5. O Nginx serve imediatamente o conteúdo do volume compartilhado.

## Operação e segurança

- Os contêineres podem ser substituídos; o volume `content_data` deve ser preservado.
- TLS, rate limiting e logs centralizados devem ser configurados no proxy ou plataforma que estiver à frente do Nginx.
- O painel possui `noindex`, sessão segura, CSRF, limitação de login e senha com hash scrypt.
- Telefones e demais dados em `conteudo.json` são públicos porque chegam ao navegador.
- Atualize conscientemente versões e URLs de CDN definidas nos arquivos HTML.
- A API mantém 30 backups no volume; exporte-os também para armazenamento externo.
