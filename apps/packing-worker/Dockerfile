FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/packing-worker/package.json apps/packing-worker/package.json
RUN npm ci --workspace=@nomo/packing-worker --include-workspace-root

COPY apps/packing-worker apps/packing-worker
RUN npm run build --workspace=@nomo/packing-worker

ENV NODE_ENV=production
USER node
CMD ["node", "apps/packing-worker/dist/index.js"]
