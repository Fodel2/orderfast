#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

echo "[db:push] Target project ref: ${SUPABASE_PROJECT_REF}"
echo "[db:push] Migration files in supabase/migrations:"
ls -1 supabase/migrations/*.sql

if ! command -v supabase >/dev/null 2>&1; then
  echo "[db:push] Supabase CLI not found in PATH" >&2
  exit 1
fi

link_args=(link --project-ref "${SUPABASE_PROJECT_REF}")
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  link_args+=(--password "${SUPABASE_DB_PASSWORD}")
fi

supabase "${link_args[@]}"
supabase db push --linked --include-all --yes

echo "[db:push] Completed successfully"
