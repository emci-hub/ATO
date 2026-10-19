# Baseline schema (reference only)

`me_connections_public_profile.sql` records the base tables and functions that were created in the
Supabase dashboard before this repo kept migrations: `public.me`, `public.connections`,
`public.public_profile`, plus their policies, triggers and constraints as the **live** database held them on
2026-10-19 (before wave98). It is read with the CLI, never run:

```
supabase db query --linked -o json -f <query.sql>
```

It is **not** a migration. Do not add it to `supabase/migrations/`. A fresh project cannot be rebuilt
from migrations alone until a real `pg_dump` baseline is taken (needs Docker or a direct DB URL; neither is
set up on this machine). Until then this file is the reviewable record that closes red-team finding S18.

To refresh: re-run the column / constraint / index / policy / trigger queries (`pg_attribute`,
`pg_constraint`, `pg_indexes`, `pg_policies`, `pg_trigger`, `pg_get_functiondef`) for `me` and `connections`,
and update the file by hand. Later migrations (wave98 and after) change what is live; this file stays a
dated snapshot.
