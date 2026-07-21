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
- **CMS baseado em Git:** o Decap CMS persiste publicações como commits, mantendo histórico e revisão no repositório.
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

1. O editor abre `/admin`.
2. Netlify Identity autentica o usuário.
3. Decap CMS lê e altera `conteudo.json` via Git Gateway.
4. A alteração entra na branch `main`.
5. O deploy da Netlify publica a nova versão.

O contêiner Docker serve um snapshot produzido no momento do `docker build`. Para incorporar commits de conteúdo posteriores, reconstrua e recrie o serviço.

## Operação e segurança

- O contêiner não armazena estado e pode ser substituído livremente.
- TLS, rate limiting e logs centralizados devem ser configurados no proxy ou plataforma que estiver à frente do Nginx.
- O painel possui `noindex`; o controle de acesso efetivo pertence ao Netlify Identity/Git Gateway.
- Telefones e demais dados em `conteudo.json` são públicos porque chegam ao navegador.
- Atualize conscientemente versões e URLs de CDN definidas nos arquivos HTML.
- Faça backup pelo próprio repositório Git; ele é a fonte de verdade do conteúdo.

