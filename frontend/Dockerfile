# syntax=docker/dockerfile:1

# Development image. Vite dev server with HMR; source is bind-mounted by docker-compose.
FROM node:22-alpine AS dev

RUN corepack enable

WORKDIR /app

# Copy manifests first so dependency installs cache across source changes.
COPY package.json pnpm-lock.yaml* ./
# The real workspace root (which whitelists esbuild's postinstall) sits outside this build context,
# so stand up a minimal one here. It is shadowed by the bind mount at runtime, which is fine —
# installation happens at build time.
RUN printf 'packages: []\nallowBuilds:\n  esbuild: true\n' > pnpm-workspace.yaml \
    && pnpm install

COPY . .

# Run Vite directly: at runtime the bind mount hides the lockfile pnpm would want to verify
# against, and pnpm would try to purge and reinstall node_modules on every boot.
EXPOSE 5173
CMD ["node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "5173"]


# Production build. Static assets served by nginx — mirrors a Cloudflare Pages deploy closely
# enough to catch build-time problems locally.
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

# The lockfile lives at the workspace root, outside this build context, so no --frozen-lockfile.
COPY package.json pnpm-lock.yaml* ./
# The real workspace root (which whitelists esbuild's postinstall) sits outside this build context,
# so stand up a minimal one here. It is shadowed by the bind mount at runtime, which is fine —
# installation happens at build time.
RUN printf 'packages: []\nallowBuilds:\n  esbuild: true\n' > pnpm-workspace.yaml \
    && pnpm install

COPY . .
RUN pnpm build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
