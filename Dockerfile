# Build stage: the full Node image includes compiler tools, so the database library can always be built.
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

# Run stage: small image from the same Debian family, so the compiled library works unchanged.
FROM node:22-slim
WORKDIR /app
COPY --from=build /app /app
# On a host with a persistent disk, mount the disk at /data (or set DB_PATH to a file on the disk).
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/app.db
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
