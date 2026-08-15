# syntax=docker/dockerfile:1.7
FROM node:22.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci
COPY . .
RUN npm run build && npm run check:commands

FROM node:22.22.3-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "--enable-source-maps", "dist/main.js"]
