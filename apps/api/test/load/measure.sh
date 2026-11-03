#!/usr/bin/env bash
# Runs a command (a k6 run) and reports what PostgreSQL and the API process did meanwhile:
# commits, rows written and read (pg_stat_database deltas), CPU of the PostgreSQL container
# (docker stats) and of the API process (ps), and the top statements when pg_stat_statements
# is loaded.
#   PG_CONTAINER=<name> API_PID=<pid> test/load/measure.sh k6 run test/load/runs.js
set -u

PG_CONTAINER="${PG_CONTAINER:-workflow-platform-postgres-1}"
PGUSER="${PGUSER:-workflow}"
PGDATABASE="${PGDATABASE:-workflow}"
API_PID="${API_PID:-}"
SAMPLE_SECONDS="${SAMPLE_SECONDS:-2}"
work="$(mktemp -d)"

psql() {
  docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -At -F ' ' -c "$1"
}

counters() {
  psql "select xact_commit, xact_rollback, tup_inserted, tup_updated, tup_deleted,
               tup_fetched, tup_returned, blks_read, blks_hit
        from pg_stat_database where datname = current_database()"
}

psql "select pg_stat_statements_reset()" >/dev/null 2>&1
before="$(counters)"
started="$(date +%s)"

(
  while true; do
    docker stats --no-stream --format '{{.CPUPerc}}' "$PG_CONTAINER" | tr -d '%' >>"$work/pg-cpu"
    if [ -n "$API_PID" ]; then ps -o %cpu= -p "$API_PID" >>"$work/api-cpu"; fi
    sleep "$SAMPLE_SECONDS"
  done
) &
sampler=$!

"$@"
status=$?

kill "$sampler" 2>/dev/null
wait "$sampler" 2>/dev/null
after="$(counters)"
seconds=$(($(date +%s) - started))

echo "--- PostgreSQL during the run (${seconds}s) ---"
paste <(echo "$before" | tr ' ' '\n') <(echo "$after" | tr ' ' '\n') |
  awk -v s="$seconds" 'BEGIN { split("commits rollbacks inserted updated deleted fetched returned blks_read blks_hit", n, " ") }
       { d = $2 - $1; printf "%-10s %12d  (%.0f/s)\n", n[NR], d, d / (s > 0 ? s : 1) }'

summary() {
  awk '{ sum += $1; if ($1 > max) max = $1; n += 1 }
       END { if (n) printf "avg %.0f%%  max %.0f%%  (%d samples)\n", sum / n, max, n }' "$1"
}

if [ -s "$work/pg-cpu" ]; then echo "postgres cpu: $(summary "$work/pg-cpu")"; fi
if [ -s "$work/api-cpu" ]; then echo "api cpu:      $(summary "$work/api-cpu")"; fi

echo "--- top statements by total time (pg_stat_statements) ---"
psql "select calls, round(total_exec_time)::bigint as total_ms,
             round(mean_exec_time::numeric, 3) as mean_ms, left(regexp_replace(query, '\s+', ' ', 'g'), 110)
      from pg_stat_statements where dbid = (select oid from pg_database where datname = current_database())
      order by total_exec_time desc limit ${TOP:-12}" 2>/dev/null || echo "(pg_stat_statements not loaded)"

rm -rf "$work"
exit "$status"
