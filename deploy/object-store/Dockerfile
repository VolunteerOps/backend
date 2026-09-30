# Release and multi-architecture digests verified against Docker Hub on 2026-09-30.
FROM chrislusf/seaweedfs:4.48@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d AS seaweed
FROM node:24.20-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
WORKDIR /opt/resq-storage
COPY --from=seaweed /usr/bin/weed /usr/local/bin/weed
COPY deploy/object-store/gateway.mjs deploy/object-store/start.mjs deploy/object-store/healthcheck.mjs ./
RUN /usr/local/bin/weed version && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
# The entrypoint only changes ownership of the mounted directory, then drops
# privileges to uid/gid 1000 before opening sockets or starting SeaweedFS.
HEALTHCHECK --interval=30s --timeout=6s --start-period=90s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "start.mjs"]
