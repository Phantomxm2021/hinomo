# Localized AI Inventory Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI-generated inventory display fields follow the account language while allowing both Chinese and English queries to find the same AI or promoted formal item, including historical AI data.

**Architecture:** Snapshot `profiles.locale` onto each packing session, pass that locale through every Qwen stage, validate the final display name deterministically, and persist normalized bilingual aliases on detected and formal items. Database search stays synchronous and model-free. A separate leased backfill queue enriches historical AI items without changing their display fields or packing session state.

**Tech Stack:** PostgreSQL/Supabase migrations and pgTAP, Supabase Edge Functions on Deno, OpenAI-compatible Qwen SDK, Zod 3, React Query, generated Supabase TypeScript types, Vitest.

---

## File map

- Create `supabase/migrations/202608050001_localized_ai_inventory_search.sql`: locale snapshot, alias columns, promotion/search changes, backfill queue and service-role RPCs.
- Create `supabase/functions/packing-worker/localization.ts`: locale types, alias normalization and deterministic display-name fallback.
- Create `supabase/functions/packing-worker/localization_test.ts`: pure unit tests for language and alias rules.
- Modify `supabase/functions/packing-worker/qwen.ts`: locale-aware prompts, Schema v2 aliases, text-only alias generation.
- Modify `supabase/functions/packing-worker/qwen_test.ts`: Schema v2 and prompt-contract tests.
- Modify `supabase/functions/packing-worker/types.ts`: Schema/prompt versions, session locale and alias-job types.
- Modify `supabase/functions/packing-worker/pipeline.ts`: propagate locale, persist aliases, claim/process historical alias jobs.
- Modify `supabase/functions/packing-worker/index.ts`: drain both analysis and alias queues.
- Modify `supabase/tests/database/003_search.test.sql`: bilingual formal-item search and escaping.
- Modify `supabase/tests/database/014_ai_packing_sessions.test.sql`: locale snapshot, immutability, promotion alias copy.
- Modify `supabase/tests/database/015_supabase_packing_runtime.test.sql`: backfill queue privileges, claim/complete behavior and session-state isolation.
- Modify `apps/web/src/lib/database.types.ts`: generated schema changes.
- Modify `apps/web/src/lib/database.types.test-d.ts`: compile-time coverage for locale and aliases.
- Modify `docs/runbooks/deployment.md`: add the migration and rollout/read-only verification sequence.
- Modify `docs/superpowers/specs/2026-08-03-ai-packing-photo-atlas-design.md`: mark the approved design as implemented only after verification.

## Task 1: Add failing database contract tests

**Files:**
- Modify: `supabase/tests/database/003_search.test.sql`
- Modify: `supabase/tests/database/014_ai_packing_sessions.test.sql`

- [ ] **Step 1: Add failing bilingual search tests**

Increase the plan count in `003_search.test.sql`, give the owner item a Chinese alias, and assert both scripts find the same row:

```sql
update public.items
set search_aliases = array['键盘', 'computer keyboard']::text[]
where id = '43000000-0000-0000-0000-000000000001';

select is(
  (select item_id from public.search_my_items('键盘')),
  '43000000-0000-0000-0000-000000000001'::uuid,
  'Chinese alias finds an English-named formal item'
);
select is(
  (select item_id from public.search_my_items('computer keyboard')),
  '43000000-0000-0000-0000-000000000001'::uuid,
  'English alias finds the same formal item'
);
```

- [ ] **Step 2: Add failing session and promotion tests**

In `014_ai_packing_sessions.test.sql`, set the packing owner profile to `en-US` before creating a session and add these assertions. When preparing the detected item used by promotion, set `search_aliases = array['键盘','keyboard']` and assert the promoted `items` row receives the same array.

```sql
insert into public.profiles (id, locale)
values (tests.get_supabase_uid('packing-owner'), 'en-US')
on conflict (id) do update set locale = excluded.locale;

select is(
  (select output_locale from public.packing_sessions where id = (select session_id from packing_test_state)),
  'en-US',
  'packing session snapshots the owner locale'
);
select throws_ok(
  $$update public.packing_sessions set output_locale = 'zh-CN'
    where id = (select session_id from packing_test_state)$$,
  '22023', 'packing session output locale is immutable',
  'session locale cannot change after creation'
);
select is(
  (select search_aliases from public.items
   where id = (select target_item_id from public.packing_item_promotions
               where detected_item_id = (select detected_item_id from packing_test_state))),
  array['键盘','keyboard']::text[],
  'promotion copies bilingual aliases to the formal item'
);
```

- [ ] **Step 3: Run database tests and verify RED**

Run:

```bash
npm run test:db
```

Expected: FAIL because `output_locale` and `search_aliases` do not exist. If Docker is unavailable, start Docker before continuing; do not treat an infrastructure error as the required RED result.

## Task 2: Implement locale snapshot, alias storage, search and promotion

**Files:**
- Create: `supabase/migrations/202608050001_localized_ai_inventory_search.sql`

- [ ] **Step 1: Add locale and alias columns**

Start the migration with additive, backward-compatible columns and a deterministic locale backfill:

```sql
alter table public.packing_sessions add column output_locale text;
update public.packing_sessions sessions
set output_locale = coalesce(profiles.locale, 'zh-CN')
from public.profiles profiles
where profiles.id = sessions.owner_id;
update public.packing_sessions set output_locale = 'zh-CN' where output_locale is null;
alter table public.packing_sessions
  alter column output_locale set default 'zh-CN',
  alter column output_locale set not null,
  add constraint packing_sessions_output_locale_check check (output_locale in ('zh-CN', 'en-US'));

alter table public.packing_detected_items
  add column search_aliases text[] not null default '{}'::text[];
alter table public.items
  add column search_aliases text[] not null default '{}'::text[];
```

Add one immutable validator and use it for both column constraints so direct database writes cannot bypass the 80-character rule:

```sql
create function private.valid_search_aliases(p_aliases text[])
returns boolean language sql immutable set search_path = pg_catalog as $$
  select cardinality(p_aliases) <= 16
    and not exists (
      select 1 from unnest(p_aliases) alias
      where alias is null or char_length(btrim(alias)) not between 1 and 80
    );
$$;
alter table public.packing_detected_items add constraint packing_detected_items_search_aliases_check
  check (private.valid_search_aliases(search_aliases));
alter table public.items add constraint items_search_aliases_check
  check (private.valid_search_aliases(search_aliases));
```

- [ ] **Step 2: Snapshot locale and make it immutable**

Replace the latest `create_packing_session(uuid)` body from `202608030006_ai_credits_stripe.sql` so its insert is:

```sql
insert into public.packing_sessions (box_id, owner_id, output_locale)
select p_box_id, caller, coalesce(profiles.locale, 'zh-CN')
from (select 1) seed
left join public.profiles profiles on profiles.id = caller
returning * into created_session;
```

Add an immutable trigger that still permits insertion:

```sql
create function private.prevent_packing_output_locale_update()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if old.output_locale is distinct from new.output_locale then
    raise exception using errcode = '22023', message = 'packing session output locale is immutable';
  end if;
  return new;
end;
$$;
create trigger packing_sessions_output_locale_immutable
before update of output_locale on public.packing_sessions
for each row execute function private.prevent_packing_output_locale_update();
```

- [ ] **Step 3: Extend search without adding model latency**

In the current `search_my_items(text)` and both formal/AI branches of `search_my_inventory(text)`, replace the searchable expression with the corresponding form below while preserving the existing escaped pattern, ownership checks, return shape and 100-row limit:

```sql
pg_catalog.lower(
  coalesce(items.name, '') || ' ' || coalesce(items.category, '') || ' ' ||
  coalesce(items.description, '') || ' ' ||
  coalesce(pg_catalog.array_to_string(items.search_aliases, ' '), '')
) ilike search_pattern.value escape E'\\'
```

```sql
pg_catalog.lower(
  coalesce(detected.name, '') || ' ' || coalesce(detected.category, '') || ' ' ||
  coalesce(detected.description, '') || ' ' ||
  coalesce(pg_catalog.array_to_string(detected.search_aliases, ' '), '')
) ilike search_pattern.value escape E'\\'
```

Keep one result per item. Add a match-rank expression so an exact display-name match sorts before an alias-only match within the existing source priority.

Extend `search_pattern` with `lower(btrim(p_query)) as needle`, select this rank in both result branches, and order by it after `source_rank`:

```sql
case
  when pg_catalog.lower(items.name) = search_pattern.needle then 0
  when pg_catalog.lower(items.name) ilike search_pattern.value escape E'\\' then 1
  else 2
end as match_rank
```

Use the same expression with `detected.name` in the AI branch and finish with `order by source_rank, match_rank, updated_at desc, item_name`.

- [ ] **Step 4: Copy aliases during promotion**

Replace `finalize_packing_item_promotion(uuid,text,bigint)` using the latest existing function body and add `search_aliases` to the insert:

```sql
insert into public.items (
  id, box_id, name, category, quantity, description, search_aliases,
  image_object_key, image_mime_type, image_size_bytes
) values (
  promotion.target_item_id, detected.box_id, detected.name, detected.category,
  detected.quantity_value, detected.description, detected.search_aliases,
  promotion.target_object_key, p_mime_type, p_size_bytes
) on conflict (id) do update
set search_aliases = (
  select coalesce(array_agg(distinct alias order by alias), '{}'::text[])
  from unnest(public.items.search_aliases || excluded.search_aliases) alias
);
```

Do not update the formal item name, category or description in the conflict branch.

- [ ] **Step 5: Run database tests and verify GREEN for schema/search/promotion**

Run:

```bash
npm run test:db
```

Expected: all pgTAP files pass.

- [ ] **Step 6: Commit the database foundation**

```bash
git add supabase/migrations/202608050001_localized_ai_inventory_search.sql supabase/tests/database
git commit -m "feat: add localized inventory search storage"
```

## Task 3: Build locale and alias normalization with TDD

**Files:**
- Create: `supabase/functions/packing-worker/localization.ts`
- Create: `supabase/functions/packing-worker/localization_test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create tests for Unicode normalization, length/count limits, case-insensitive deduplication, display-name removal and locale fallback:

```ts
import { normalizeLocalizedItem } from './localization.ts'

Deno.test('uses a Chinese alias when a Chinese session receives an English name', () => {
  const item = normalizeLocalizedItem({
    name: 'keyboard',
    search_aliases: { 'zh-CN': [' 键盘 ', '电脑键盘'], 'en-US': ['Keyboard'] },
  }, 'zh-CN')
  if (item.name !== '键盘') throw new Error('Chinese alias was not promoted to display name')
  if (!item.searchAliases.includes('keyboard')) throw new Error('original name was not retained as an alias')
})

Deno.test('rejects a locale mismatch without a usable target alias', () => {
  let rejected = false
  try {
    normalizeLocalizedItem({ name: 'keyboard', search_aliases: { 'zh-CN': [], 'en-US': [] } }, 'zh-CN')
  } catch (error) {
    rejected = error instanceof Error && error.message === 'packing_output_locale_invalid'
  }
  if (!rejected) throw new Error('invalid localized name was accepted')
})
```

Add separate tests proving each locale is capped at 8 valid aliases, values over 80 Unicode characters are dropped, `Keyboard` and `keyboard` deduplicate, and `Apple Magic Keyboard 键盘` is valid for `zh-CN`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
deno test --config supabase/functions/packing-worker/deno.json supabase/functions/packing-worker/localization_test.ts
```

Expected: FAIL because `localization.ts` does not exist.

- [ ] **Step 3: Implement the pure localization module**

Create these public contracts and keep Qwen/database concerns out of this file:

```ts
export type PackingLocale = 'zh-CN' | 'en-US'
export type LocalizedAliases = Record<PackingLocale, unknown[]>

export function isPackingLocale(value: unknown): value is PackingLocale {
  return value === 'zh-CN' || value === 'en-US'
}

function hasTargetScript(value: string, locale: PackingLocale): boolean {
  return locale === 'zh-CN' ? /\p{Script=Han}/u.test(value) : /[A-Za-z]/.test(value)
}

export function normalizeLocalizedItem(
  input: { name: string; search_aliases: LocalizedAliases },
  locale: PackingLocale,
): { name: string; searchAliases: string[] } {
  const normalizedName = input.name.normalize('NFKC').trim()
  const byLocale = (['zh-CN', 'en-US'] as const).map((key) =>
    input.search_aliases[key]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.normalize('NFKC').trim())
      .filter((value) => Array.from(value).length >= 1 && Array.from(value).length <= 80)
      .filter((value, index, values) => values.findIndex((candidate) =>
        candidate.toLocaleLowerCase('en-US') === value.toLocaleLowerCase('en-US')) === index)
      .slice(0, 8),
  )
  const targetAliases = locale === 'zh-CN' ? byLocale[0] : byLocale[1]
  const displayName = hasTargetScript(normalizedName, locale)
    ? normalizedName
    : targetAliases.find((alias) => hasTargetScript(alias, locale))
  if (!displayName) throw new Error('packing_output_locale_invalid')
  const aliases = [normalizedName, ...byLocale.flat()]
    .filter((value) => value.toLocaleLowerCase('en-US') !== displayName.toLocaleLowerCase('en-US'))
    .filter((value, index, values) => values.findIndex((candidate) =>
      candidate.toLocaleLowerCase('en-US') === value.toLocaleLowerCase('en-US')) === index)
    .slice(0, 16)
  return { name: displayName, searchAliases: aliases }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run the localization test command again. Expected: all localization tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/packing-worker/localization.ts supabase/functions/packing-worker/localization_test.ts
git commit -m "feat: normalize localized AI item names"
```

## Task 4: Make Qwen Schema v2 locale-aware

**Files:**
- Modify: `supabase/functions/packing-worker/types.ts`
- Modify: `supabase/functions/packing-worker/qwen.ts`
- Modify: `supabase/functions/packing-worker/qwen_test.ts`

- [ ] **Step 1: Write failing Schema and prompt tests**

Update existing fixtures to Schema `2` and add tests that parse bilingual aliases while dropping one malformed alias. Export a pure prompt builder and assert both locale instructions:

```ts
import { consolidationSchema, packingLanguageRules } from './qwen.ts'

Deno.test('builds explicit Chinese output rules', () => {
  const rules = packingLanguageRules('zh-CN')
  if (!rules.includes('简体中文')) throw new Error('Chinese locale rule is missing')
  if (!rules.includes('品牌和型号')) throw new Error('brand preservation rule is missing')
})

Deno.test('accepts bilingual aliases and drops malformed alias entries', () => {
  const parsed = consolidationSchema.parse({
    schema_version: '2',
    items: [{
      client_id: 'item-1', name: '键盘', category: '电脑配件', description: null,
      search_aliases: { 'zh-CN': ['电脑键盘', 7], 'en-US': ['keyboard'] },
      quantity: { kind: 'exact', value: 1 }, visibility: 'clear', needs_review: false,
      instances: [{ client_id: 'instance-1', provisional_name: '键盘', first_seen_photo_id: 'P001',
        last_seen_photo_id: 'P001', representative_photo_id: 'P001', evidence_photo_ids: ['P001'], tracking_status: 'tracked' }],
    }],
  })
  if (parsed.items[0]?.search_aliases['zh-CN'].length !== 1) throw new Error('bad alias was not dropped')
})
```

- [ ] **Step 2: Run Qwen tests and verify RED**

Run:

```bash
deno test --config supabase/functions/packing-worker/deno.json supabase/functions/packing-worker/qwen_test.ts
```

Expected: FAIL because Schema v2, `search_aliases`, and `packingLanguageRules` are absent.

- [ ] **Step 3: Upgrade versions and schemas**

In `types.ts` set:

```ts
export const PACKING_MODEL_SCHEMA_VERSION = '2'
export const PACKING_PROMPT_VERSION = 'packing-atlas-v5-localized'
export const PACKING_ALIAS_VERSION = 'packing-alias-v1'
```

Add `output_locale: PackingLocale` to `PackingSession`. In `qwen.ts`, define an alias schema that accepts unknown array members and transforms to strings only:

```ts
const aliasListSchema = z.array(z.unknown()).transform((values) =>
  values.filter((value): value is string => typeof value === 'string'))
const localizedAliasesSchema = z.object({
  'zh-CN': aliasListSchema,
  'en-US': aliasListSchema,
})
```

Add `search_aliases: localizedAliasesSchema` to each consolidated item. Replace hard-coded `"schema_version":"1"` contract strings with `${JSON.stringify(PACKING_MODEL_SCHEMA_VERSION)}`.

- [ ] **Step 4: Pass locale explicitly to every model stage**

Export this pure builder and use it as the system prompt prefix:

```ts
export function packingLanguageRules(locale: PackingLocale): string {
  return locale === 'zh-CN'
    ? '所有自然语言字段必须使用简体中文；品牌、型号和行业缩写保留原文并与中文通用名组合。'
    : 'All natural-language fields must use English; preserve brand names, model numbers, and standard abbreviations.'
}
```

Add a `locale: PackingLocale` argument to `observeAtlas`, `consolidateObservations`, `reviewOriginalObservation`, `localizeInstance`, and `validateItemCrop`. The consolidation contract must require both alias keys and prohibit aliases from adding unseen facts.

- [ ] **Step 5: Add one-shot language repair without new facts**

Add `repairConsolidationLanguage(services, usage, input)` as a text-only call that receives the already validated consolidation JSON and target locale. Its prompt must say: change only natural-language strings and bilingual aliases, preserve item/instance IDs, evidence IDs, quantities, visibility and review flags exactly, and add no facts. Extend `QwenUsageContext.operation` with `language_repair` and cover the repair prompt with a unit test.

- [ ] **Step 6: Add text-only historical alias generation**

Add `generateSearchAliases(services, usage, input)` using the same OpenAI-compatible `callQwen` path without an image. Input contains current name, category and locale; output contains only `schema_version` and the two alias arrays. Extend `QwenUsageContext.operation` with `alias_backfill`.

- [ ] **Step 7: Run Qwen and worker type checks**

```bash
deno test --config supabase/functions/packing-worker/deno.json supabase/functions/packing-worker/qwen_test.ts supabase/functions/packing-worker/localization_test.ts
npm run typecheck:worker
```

Expected: all tests pass and Deno reports no type errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/packing-worker/types.ts supabase/functions/packing-worker/qwen.ts supabase/functions/packing-worker/qwen_test.ts
git commit -m "feat: enforce AI output locale in Qwen"
```

## Task 5: Propagate locale and persist aliases in the pipeline

**Files:**
- Create: `supabase/functions/packing-worker/pipeline_test.ts`
- Modify: `supabase/functions/packing-worker/pipeline.ts`

- [ ] **Step 1: Write a failing materialization seam test**

Extract and export a pure `prepareDetectedItem` helper from `pipeline.ts`. Test it before implementing:

```ts
Deno.test('prepares a Chinese display name and flattened aliases for storage', () => {
  const prepared = prepareDetectedItem({
    name: 'keyboard', category: '电脑配件', description: null,
    search_aliases: { 'zh-CN': ['键盘'], 'en-US': ['keyboard'] },
    quantity: { kind: 'exact', value: 1 }, visibility: 'clear', needs_review: false, instances: [],
  }, 'zh-CN')
  if (prepared.name !== '键盘') throw new Error('localized name was not selected')
  if (!prepared.search_aliases.includes('keyboard')) throw new Error('English alias was not persisted')
})
```

- [ ] **Step 2: Run pipeline test and verify RED**

```bash
deno test --config supabase/functions/packing-worker/deno.json supabase/functions/packing-worker/pipeline_test.ts
```

Expected: FAIL because `prepareDetectedItem` is not exported.

- [ ] **Step 3: Thread the session locale through jobs**

Load `PackingSession` at the beginning of `observe`, `track`, `materialize`, `localize`, and `publish` only where required, and pass `session.output_locale` to every Qwen function. Do not read `profiles.locale` from individual stages. In `track`, run `normalizeLocalizedItem` against every consolidated item; on the first locale failure call `repairConsolidationLanguage` exactly once, validate the repaired result again, and throw `packing_output_locale_invalid` if it is still wrong. Complete the track job only with the validated original or repaired result.

Implement the pure seam:

```ts
export type ConsolidatedInstance = {
  provisional_name: string
  first_seen_photo_id: string
  last_seen_photo_id: string
  representative_photo_id: string
  evidence_photo_ids: string[]
  tracking_status: string
}

export type ConsolidatedItem = {
  name: string
  category: string | null
  description: string | null
  search_aliases: LocalizedAliases
  quantity: { kind: string; value: number | null }
  visibility: string
  needs_review: boolean
  instances: ConsolidatedInstance[]
}

export function prepareDetectedItem(item: ConsolidatedItem, locale: PackingLocale) {
  const localized = normalizeLocalizedItem(item, locale)
  return { ...item, name: localized.name, search_aliases: localized.searchAliases }
}
```

In `materialize`, call it before inserting and include `search_aliases` in `packing_detected_items.insert`. If it throws `packing_output_locale_invalid`, allow the job's existing retry/failure path to handle it; do not publish the draft revision.

- [ ] **Step 4: Verify GREEN**

```bash
deno test --config supabase/functions/packing-worker/deno.json supabase/functions/packing-worker/pipeline_test.ts
npm run test:worker
npm run typecheck:worker
```

Expected: pipeline seam and all existing Worker tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/packing-worker/pipeline.ts supabase/functions/packing-worker/pipeline_test.ts
git commit -m "feat: persist localized AI inventory aliases"
```

## Task 6: Implement the isolated historical alias queue

**Files:**
- Modify: `supabase/migrations/202608050001_localized_ai_inventory_search.sql`
- Modify: `supabase/tests/database/015_supabase_packing_runtime.test.sql`
- Modify: `supabase/functions/packing-worker/types.ts`
- Modify: `supabase/functions/packing-worker/pipeline.ts`
- Modify: `supabase/functions/packing-worker/index.ts`
- Modify: `supabase/functions/packing-worker/pipeline_test.ts`

- [ ] **Step 1: Add failing database queue tests**

Extend `015_supabase_packing_runtime.test.sql` with table/function/privilege checks:

```sql
select has_table('public', 'packing_search_alias_jobs', 'alias backfill queue exists');
select has_function('public', 'claim_packing_search_alias_jobs',
  array['integer', 'integer'], 'worker can lease alias jobs');
select has_function('public', 'complete_packing_search_alias_job',
  array['uuid', 'text[]'], 'worker can complete alias jobs');
select ok(not has_table_privilege('authenticated',
  'public.packing_search_alias_jobs', 'select'), 'clients cannot inspect alias jobs');
```

Create one historical detected item with `search_aliases = '{}'`, record its session status, create a pending alias job, claim it under `set local role service_role`, complete it with `array['键盘','keyboard']`, and assert the detected aliases changed while the recorded session status did not. Create a completed promotion target for that detected item and assert the same completion RPC merges both aliases into the formal `items` row.

- [ ] **Step 2: Run database tests and verify RED**

```bash
npm run test:db
```

Expected: FAIL because `packing_search_alias_jobs` and its RPCs do not exist.

- [ ] **Step 3: Write failing Worker queue tests**

Make `processPackingSearchAliasJob` accept an optional generator dependency whose production default is `generateSearchAliases`. In `pipeline_test.ts`, provide a minimal fake RPC service and generator to prove one job passes normalized aliases to `complete_packing_search_alias_job`. Provide a throwing generator and assert it calls `fail_packing_search_alias_job` and never invokes any session-status RPC.

- [ ] **Step 4: Run the focused Worker test and verify RED**

```bash
deno test --config supabase/functions/packing-worker/deno.json supabase/functions/packing-worker/pipeline_test.ts
```

Expected: FAIL because alias claiming and processing are not implemented.

- [ ] **Step 5: Add the queue table and service-role RPCs**

Add `packing_search_alias_jobs` with a foreign key to `packing_detected_items`, a unique `(detected_item_id, alias_version)`, status check, attempts, retry time, lease, error and timestamps. Enable RLS, revoke all client privileges, and grant only service role access.

Implement:

```sql
public.claim_packing_search_alias_jobs(p_batch_size integer default 1, p_lease_seconds integer default 390)
public.complete_packing_search_alias_job(p_job_id uuid, p_search_aliases text[])
public.fail_packing_search_alias_job(p_job_id uuid, p_error_code text, p_retryable boolean)
```

The claim RPC must use `for update skip locked`; return job ID, detected item ID, session ID, current name/category, owner locale and attempts. The completion RPC must normalize `null` to an empty array, reject more than 16 entries, update only `packing_detected_items.search_aliases`, merge aliases into a completed promotion target `items.search_aliases`, and mark the job completed in one transaction. The failure RPC uses the existing exponential-backoff pattern but must never update `packing_sessions`.

- [ ] **Step 6: Seed historical work idempotently**

At the end of the migration insert jobs only for empty aliases and wake once:

```sql
insert into public.packing_search_alias_jobs (detected_item_id, alias_version)
select detected.id, 'packing-alias-v1'
from public.packing_detected_items detected
where cardinality(detected.search_aliases) = 0
on conflict (detected_item_id, alias_version) do nothing;

select private.invoke_packing_edge_function()
where exists (select 1 from public.packing_search_alias_jobs where status = 'pending');
```

- [ ] **Step 7: Implement queue processing and draining**

Add `PackingSearchAliasJob` to `types.ts`. Export `claimPackingSearchAliasJobs` and `processPackingSearchAliasJob` from `pipeline.ts`. Normalize the model response using `normalizeLocalizedItem` for validation but pass only aliases to the completion RPC; never replace the historical name.

In `index.ts`, claim one normal job and one alias job per invocation, process both with `Promise.all`, and self-invoke again when either claim returned work:

```ts
const [jobs, aliasJobs] = await Promise.all([
  claimPackingJobs(services),
  claimPackingSearchAliasJobs(services),
])
await Promise.all([
  ...jobs.map((job) => processPackingJob(services, job)),
  ...aliasJobs.map((job) => processPackingSearchAliasJob(services, job)),
])
if (jobs.length > 0 || aliasJobs.length > 0) await wakeSelf()
```

Extract the existing self-fetch block into this defined helper before calling it:

```ts
async function wakeSelf(): Promise<void> {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('PACKING_FUNCTION_SECRET')
  if (!baseUrl || !secret) return
  await fetch(`${baseUrl}/functions/v1/packing-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-packing-secret': secret },
    body: '{}',
  })
}
```

Retain the existing per-job error logging and use only IDs/error codes.

- [ ] **Step 8: Verify database and Worker queues GREEN**

```bash
npm run test:db
npm run test:worker
npm run typecheck:worker
```

Expected: pgTAP, Deno tests and Deno check all pass.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/202608050001_localized_ai_inventory_search.sql supabase/functions/packing-worker supabase/tests/database
git commit -m "feat: backfill bilingual AI search aliases"
```

## Task 7: Update generated web types and regression coverage

**Files:**
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`
- Modify: `apps/web/src/features/search/search.api.test.ts`

- [ ] **Step 1: Add a failing compile-time type assertion**

Add assertions that packing sessions expose `output_locale`, both item tables expose `search_aliases`, and the backfill table is not required by client code:

```ts
declare const packingSession: Omit<Database['public']['Tables']['packing_sessions']['Row'], 'output_locale'>
const localizedSession: Database['public']['Tables']['packing_sessions']['Row'] = {
  ...packingSession,
  output_locale: 'zh-CN',
}
const bilingualAliases: Database['public']['Tables']['items']['Update']['search_aliases'] = ['键盘', 'keyboard']
void localizedSession
void bilingualAliases
```

- [ ] **Step 2: Run typecheck and verify RED**

```bash
npm run typecheck
```

Expected: FAIL because generated database types do not contain the new columns.

- [ ] **Step 3: Regenerate or mechanically update database types**

With the migration applied to the local Supabase database, generate types and replace `apps/web/src/lib/database.types.ts` with the generated output:

```bash
supabase gen types typescript --local
```

Capture the command output, then update the tracked file using the repository editing workflow. Confirm `search_my_inventory` has the same arguments and return shape so `search.api.ts` needs no production change.

- [ ] **Step 4: Keep the search client model-free**

In `search.api.test.ts`, retain the assertion that one call is made directly to `search_my_inventory` with the original query. Add:

```ts
expect(mockRpc).toHaveBeenCalledTimes(1)
expect(mockRpc).toHaveBeenCalledWith('search_my_inventory', { p_query: '键盘' })
```

No translation API, Qwen call, or second search request belongs in the browser.

- [ ] **Step 5: Verify web tests and types GREEN**

```bash
npm run test --workspace=@nomo/web -- search.api.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: focused search test, TypeScript, lint and production build all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts apps/web/src/features/search/search.api.test.ts
git commit -m "chore: update localized inventory database types"
```

## Task 8: Full verification and deployment handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-ai-packing-photo-atlas-design.md`
- Modify: `docs/runbooks/deployment.md`

- [ ] **Step 1: Run the complete verification matrix**

```bash
npm run test:db
npm run test:worker
npm run typecheck:worker
npm run test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0, Vitest/Deno/pgTAP report zero failures, and `git diff --check` prints nothing.

- [ ] **Step 2: Verify the original production symptom with fixtures**

Using the database test user, verify these four assertions against `search_my_inventory`:

```sql
select item_name from public.search_my_inventory('键盘');
select item_name from public.search_my_inventory('keyboard');
```

Both queries must return the same Chinese-locale item and the same English-locale item. Inspect one new `zh-CN` packing revision and confirm its display name contains a Han character. Inspect one historical English-named item and confirm only aliases changed.

- [ ] **Step 3: Mark implementation status in the SSOT**

Update the opening implementation-status sentence and the relevant Stage 4 bullets only after Step 1 and Step 2 pass. Do not weaken the rollout gates or claim historical backfill completion while jobs remain pending/failed.

- [ ] **Step 4: Update the deployment runbook**

Add `202608050001_localized_ai_inventory_search.sql` after the existing `202608040004` migration. Document this exact order: the administrator executes the reviewed SQL in the Supabase Dashboard SQL Editor; run pgTAP/read-only alias checks; deploy `packing-worker`; publish the Cloudflare Pages frontend; monitor backfill counts. Preserve the runbook rule that automation and Codex never push migrations to a real database.

- [ ] **Step 5: Commit verification documentation**

```bash
git add docs/superpowers/specs/2026-08-03-ai-packing-photo-atlas-design.md docs/runbooks/deployment.md
git commit -m "docs: record localized inventory search rollout"
```

- [ ] **Step 6: Deploy in dependency order**

The project administrator must apply the reviewed migration in the target Supabase Dashboard SQL Editor first. Do not run `supabase db push` against a real project. After the SQL and read-only verification succeed, deploy the Worker:

```bash
supabase functions deploy packing-worker --no-verify-jwt
```

Publish the already verified `apps/web/dist` build through the repository's configured Cloudflare Pages project last. Monitor `packing_search_alias_jobs` counts by status and Qwen usage/error metrics; do not log item names or aliases.
