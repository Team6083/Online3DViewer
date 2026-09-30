# syntax=docker/dockerfile:1
#
# Internal, CSP-locked deployment image for Online 3D Viewer. Produces a
# fully self-hosted static site: no runtime dependency on any CDN, so it
# keeps working under a strict `connect-src 'self'` / `script-src 'self'`
# Content-Security-Policy (see nginx.conf).

# --- vendor: fetch the wasm/JS importer libraries the engine loads from a
# CDN at runtime (source/engine/import/importerutils.js) so they can be
# served from this image instead. Pin the exact versions that file expects.
FROM node:20-alpine AS vendor
WORKDIR /vendor
RUN set -eu; \
    npm pack occt-import-js@0.0.22 rhino3dm@8.17.0 web-ifc@0.0.68 draco3d@1.5.7 \
        --silent --pack-destination /tmp >/dev/null; \
    mkdir -p /tmp/occt-import-js /tmp/rhino3dm /tmp/web-ifc /tmp/draco3d; \
    tar -xzf /tmp/occt-import-js-0.0.22.tgz -C /tmp/occt-import-js; \
    tar -xzf /tmp/rhino3dm-8.17.0.tgz -C /tmp/rhino3dm; \
    tar -xzf /tmp/web-ifc-0.0.68.tgz -C /tmp/web-ifc; \
    tar -xzf /tmp/draco3d-1.5.7.tgz -C /tmp/draco3d; \
    mkdir -p occt-import-js rhino3dm web-ifc draco3d; \
    cp /tmp/occt-import-js/package/dist/occt-import-js.js \
       /tmp/occt-import-js/package/dist/occt-import-js-worker.js \
       /tmp/occt-import-js/package/dist/occt-import-js.wasm \
       occt-import-js/; \
    cp /tmp/rhino3dm/package/rhino3dm.min.js /tmp/rhino3dm/package/rhino3dm.wasm rhino3dm/; \
    cp /tmp/web-ifc/package/web-ifc-api-iife.js /tmp/web-ifc/package/web-ifc.wasm web-ifc/; \
    cp /tmp/draco3d/package/draco_decoder_nodejs.js /tmp/draco3d/package/draco_decoder.wasm draco3d/; \
    rm -rf /tmp/occt-import-js /tmp/rhino3dm /tmp/web-ifc /tmp/draco3d /tmp/*.tgz; \
    chmod -R a+rX .

# --- builder: build the website exactly as upstream documents it
# (package.json's "create_package" script), minus the two sub-steps whose
# output CreateWebsite() in tools/create_package.py never reads:
# generate_docs (builds the separate docs/ site with the `jsdoc` CLI) and
# build_engine_module (the standalone npm-consumer module build).
FROM node:20-alpine AS builder
RUN apk add --no-cache python3
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
COPY --from=vendor /vendor website/assets/extlibs
RUN npm run build_engine && npm run build_website
RUN python3 tools/create_package.py

# --- final: static assets on nginx-unprivileged (UID/GID 101, listens on
# 8080 - required for the Deployment's runAsUser/runAsGroup: 101 and
# readOnlyRootFilesystem: true). The base image's own nginx.conf already
# points every nginx temp path (client_body/proxy/fastcgi/uwsgi/scgi) and
# the pid file at /tmp, so mounting just /tmp read-write is enough; only
# conf.d/default.conf (the CSP header) needs overriding.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build/package/website /usr/share/nginx/html
EXPOSE 8080
# Bypass docker-entrypoint.sh and its /docker-entrypoint.d/*.sh scripts:
# several of them try to edit files under /etc/nginx on container start
# (e.g. the default IPv6 check rewrites conf.d/default.conf), which fails
# under readOnlyRootFilesystem. Nothing here needs them - there's no
# envsubst templating and default.conf already hardcodes everything.
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
