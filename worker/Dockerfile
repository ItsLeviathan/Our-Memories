# Recap worker: Node + ffmpeg + fonts for the title cards.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fontconfig fonts-inter fonts-ebgaramond ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -f
WORKDIR /app
ENV NODE_ENV=production FFMPEG_PATH=/usr/bin/ffmpeg PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
