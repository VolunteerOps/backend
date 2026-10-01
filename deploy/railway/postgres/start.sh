#!/bin/sh
set -eu
: "${RESQ_DB_TLS_CERT_B64:?TLS certificate required}"
: "${RESQ_DB_TLS_KEY_B64:?TLS key required}"
case "$PGDATA" in /var/lib/postgresql/18/*) ;; *) echo 'PG18_DATA_DIRECTORY_REQUIRED' >&2; exit 1;; esac
install -d -m 0700 -o postgres -g postgres /run/resq-postgres-tls
umask 077
printf '%s' "$RESQ_DB_TLS_CERT_B64" | base64 -d > /run/resq-postgres-tls/server.crt
printf '%s' "$RESQ_DB_TLS_KEY_B64" | base64 -d > /run/resq-postgres-tls/server.key
chown postgres:postgres /run/resq-postgres-tls/server.*
chmod 0600 /run/resq-postgres-tls/server.*
unset RESQ_DB_TLS_CERT_B64 RESQ_DB_TLS_KEY_B64
# Parent traversal is required after the upstream entrypoint drops root.
install -d -m 0700 -o postgres -g postgres /var/lib/postgresql/18 "$PGDATA"
umask 022
exec /usr/local/bin/docker-entrypoint.sh "$@" -c ssl=on -c ssl_cert_file=/run/resq-postgres-tls/server.crt -c ssl_key_file=/run/resq-postgres-tls/server.key -c hba_file=/etc/resq-pg_hba.conf -c ident_file=/etc/resq-pg_ident.conf -c password_encryption=scram-sha-256 -c listen_addresses='*'
