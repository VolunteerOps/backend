ARG POSTGIS_IMAGE=postgis/postgis:18-3.6@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677
FROM ${POSTGIS_IMAGE}
ENV PGDATA=/var/lib/postgresql/18/docker
COPY deploy/railway/postgres/start.sh /usr/local/bin/resq-postgres
COPY deploy/railway/postgres/pg_hba.conf /etc/resq-pg_hba.conf
COPY deploy/railway/postgres/pg_ident.conf /etc/resq-pg_ident.conf
RUN chmod 755 /usr/local/bin/resq-postgres
ENTRYPOINT ["/usr/local/bin/resq-postgres"]
CMD ["postgres"]
