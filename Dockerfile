FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html agenda.html painel.html conteudo.json logo-color.png logo-white.png logo-ho.png footer.html footer-loader.js /usr/share/nginx/html/
RUN chmod 0644 /usr/share/nginx/html/index.html \
    /usr/share/nginx/html/agenda.html \
    /usr/share/nginx/html/painel.html \
    /usr/share/nginx/html/conteudo.json \
    /usr/share/nginx/html/logo-color.png \
    /usr/share/nginx/html/logo-white.png \
    /usr/share/nginx/html/logo-ho.png \
    /usr/share/nginx/html/footer.html \
    /usr/share/nginx/html/footer-loader.js

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1
