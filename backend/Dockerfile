FROM node:22-alpine

WORKDIR /app

# Instala solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .

# Usuario no-root para reducir superficie de ataque
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# exec reemplaza sh para que SIGTERM llegue directo a node
CMD ["sh", "-c", "node migrations/migrate.js && exec node server.js"]
