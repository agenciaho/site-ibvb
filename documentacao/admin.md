# Painel administrativo

O painel em `/admin` permite alterar destaques, transmissão, cultos, vídeos e eventos sem editar arquivos manualmente. Ele foi projetado para a implantação Docker na VPS e não depende de Netlify, Decap CMS ou credenciais GitHub no navegador.

## Arquitetura

- `painel.html`: interface responsiva de login e edição;
- serviço `admin`: API Node.js acessível somente pela rede interna do Compose;
- Nginx do contêiner `site`: encaminha `/api/admin/*` internamente para a API;
- volume `content_data`: mantém `conteudo.json`, backups e auditoria entre deploys;
- Nginx da VPS: continua encaminhando todo o domínio para `127.0.0.1:2027`.

Ao salvar, a API valida todos os campos, cria um backup, substitui o JSON de forma atômica e registra a operação. O site lê o mesmo volume, portanto a atualização aparece imediatamente.

## Primeiro acesso

Na VPS, atualize o repositório e construa a imagem administrativa:

```bash
cd ~/projetos/site-ibvb
git pull origin main
docker compose build admin
```

Edite o `.env` e defina uma senha exclusiva com pelo menos 12 caracteres:

```bash
nano .env
```

Inclua, usando aspas simples se a senha possuir `$`, `#` ou espaços:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD='uma-senha-longa-e-exclusiva'
```

O `.env` já está ignorado pelo Git, mas a senha em texto pode ser vista por administradores da VPS e pelo `docker inspect`. Restrinja o arquivo:

```bash
chmod 600 .env
```

### Opção endurecida: somente hash

Para não manter a senha recuperável no `.env`, gere um hash:

```bash
read -rsp "Senha do painel: " ADMIN_PASSWORD_INPUT; echo
printf '%s' "$ADMIN_PASSWORD_INPUT" | docker compose run --rm -T --no-deps admin node /app/hash-password.mjs
unset ADMIN_PASSWORD_INPUT
```

Copie o resultado completo iniciado por `scrypt$` e configure:

```dotenv
ADMIN_PASSWORD=
ADMIN_PASSWORD_HASH='scrypt$16384$8$1$COLE_AQUI_O_RESTANTE_DO_HASH'
```

Quando as duas variáveis estiverem preenchidas, `ADMIN_PASSWORD_HASH` tem prioridade.

Suba os serviços:

```bash
docker compose up -d --build
docker compose ps
```

Acesse `https://ibvbsantacruz.com.br/admin`.

## Segurança implementada

- suporte a senha pelo `.env` e, preferencialmente, hash `scrypt` com salt aleatório;
- cookie de sessão `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS;
- token CSRF obrigatório para gravação e logout;
- sessão expira após oito horas e é invalidada ao reiniciar a API;
- cinco tentativas de login por IP a cada 15 minutos;
- API sem porta publicada no host;
- limite de 256 KiB por requisição;
- validação de tipos, tamanhos, URLs HTTPS e telefones;
- gravação atômica para evitar JSON parcial;
- contêiner com filesystem somente leitura, capabilities removidas e `no-new-privileges`;
- painel marcado como `noindex`.

Usuários do painel devem utilizar uma senha exclusiva. TLS no Nginx da VPS é obrigatório em produção.

## Persistência e backups

O primeiro start copia o `conteudo.json` do repositório para o volume `content_data`. Depois disso, o volume passa a ser a fonte de verdade em produção. Cada salvamento mantém uma das 30 cópias mais recentes em `/data/backups` e acrescenta um registro em `/data/auditoria.log`.

Listar backups:

```bash
docker compose exec admin ls -lh /data/backups
```

Exportar o conteúdo atual:

```bash
docker compose exec -T admin cat /data/conteudo.json > conteudo-producao.json
```

Consultar auditoria:

```bash
docker compose exec admin tail -n 30 /data/auditoria.log
```

`docker compose down` preserva os dados. **Não execute `docker compose down -v`**, pois a opção `-v` remove o volume e o conteúdo administrativo.

## Troca de senha

Altere `ADMIN_PASSWORD` ou gere outro `ADMIN_PASSWORD_HASH` no `.env` e recrie somente a API:

```bash
docker compose up -d --force-recreate admin
```

Todas as sessões existentes serão encerradas.

## Diagnóstico

```bash
docker compose ps
docker compose logs --tail=100 admin
curl -I https://ibvbsantacruz.com.br/admin
```

Respostas esperadas da API:

- `401`: sessão ausente ou expirada;
- `403`: token CSRF inválido;
- `429`: limite de tentativas de login atingido;
- `503`: nenhuma senha válida foi configurada em `ADMIN_PASSWORD` ou `ADMIN_PASSWORD_HASH`.
