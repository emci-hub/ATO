# ai-library writer — removed in this branch

`supabase/functions/ai-library/index.ts` and `supabase/functions/ai-library-fill/index.ts` refuse `deep_dive` and `legend` with 410. They do not claim a write and they do not call a model.

The cron unschedule is `supabase/migrations/wave114_unschedule_ai_library.sql`. It is **not applied** in the pull request. After merge, the owner runs:

```
supabase db query --linked -f supabase/migrations/wave114_unschedule_ai_library.sql
```

Deploy the two function stubs in the same change. The migration does not delete old cards.
