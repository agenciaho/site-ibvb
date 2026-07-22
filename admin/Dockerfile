FROM node:22-alpine

WORKDIR /app
COPY admin/server.mjs admin/hash-password.mjs ./
COPY conteudo.json ./default-content.json

ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
EXPOSE 3000

CMD ["node", "/app/server.mjs"]
