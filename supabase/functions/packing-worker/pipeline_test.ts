import {
  prepareDetectedItem,
  processPackingSearchAliasJob,
  validateConsolidationLocale,
  type ConsolidatedItem,
} from './pipeline.ts'
import type { ConsolidationOutput } from './qwen.ts'
import type { PackingSearchAliasJob } from './types.ts'
import type { PackingServices } from './services.ts'

function item(overrides: Partial<ConsolidatedItem> = {}): ConsolidatedItem {
  return {
    client_id: 'item-1',
    name: 'keyboard',
    category: '电脑配件',
    description: null,
    search_aliases: { 'zh-CN': ['键盘'], 'en-US': ['keyboard'] },
    quantity: { kind: 'exact', value: 1 },
    visibility: 'clear',
    needs_review: false,
    instances: [{
      client_id: 'instance-1',
      provisional_name: '键盘',
      first_seen_photo_id: 'P001',
      last_seen_photo_id: 'P001',
      representative_photo_id: 'P001',
      evidence_photo_ids: ['P001'],
      tracking_status: 'tracked',
    }],
    ...overrides,
  }
}

Deno.test('prepares a Chinese display name and flattened aliases for storage', () => {
  const prepared = prepareDetectedItem(item(), 'zh-CN')
  if (prepared.name !== '键盘') throw new Error('localized name was not selected')
  if (!prepared.search_aliases.includes('keyboard')) throw new Error('English alias was not persisted')
  if (prepared.search_aliases.includes('键盘')) throw new Error('display name was duplicated as an alias')
})

Deno.test('prepares an English display name while retaining Chinese search aliases', () => {
  const prepared = prepareDetectedItem(item({
    name: '键盘',
    category: 'computer accessory',
    instances: [{ ...item().instances[0]!, provisional_name: 'keyboard' }],
  }), 'en-US')
  if (prepared.name !== 'keyboard') throw new Error('English display name was not selected')
  if (!prepared.search_aliases.includes('键盘')) throw new Error('Chinese alias was not persisted')
})

Deno.test('language repair runs once and preserves the repaired consolidation', async () => {
  const original = {
    schema_version: '2',
    items: [item({ search_aliases: { 'zh-CN': [], 'en-US': ['keyboard'] } })],
  } as ConsolidationOutput
  let repairCalls = 0
  const repaired: ConsolidationOutput = {
    ...original,
    items: [item({ name: '键盘', search_aliases: { 'zh-CN': ['键盘'], 'en-US': ['keyboard'] } })],
  }
  const result = await validateConsolidationLocale(original, 'zh-CN', async () => {
    repairCalls += 1
    return { data: repaired, inputTokens: 12, outputTokens: 8, durationMs: 31 }
  })
  if (repairCalls !== 1) throw new Error(`expected one repair call, got ${repairCalls}`)
  if (result.repaired !== true) throw new Error('repair result was not marked as repaired')
  if (result.data.items[0]?.name !== '键盘') throw new Error('repaired consolidation was not returned')
  if (result.repairInputTokens !== 12 || result.repairOutputTokens !== 8 || result.repairDurationMs !== 31) {
    throw new Error('repair usage metrics were not propagated')
  }
})

Deno.test('language repair is not repeated when the first repair remains invalid', async () => {
  const original = {
    schema_version: '2',
    items: [item({ search_aliases: { 'zh-CN': [], 'en-US': ['keyboard'] } })],
  } as ConsolidationOutput
  let repairCalls = 0
  let failed = false
  try {
    await validateConsolidationLocale(original, 'zh-CN', async () => {
      repairCalls += 1
      return original
    })
  } catch (error) {
    failed = error instanceof Error && error.message === 'packing_output_locale_invalid'
  }
  if (!failed) throw new Error('invalid repaired output was accepted')
  if (repairCalls !== 1) throw new Error(`expected one repair call, got ${repairCalls}`)
})

Deno.test('language repair rejects changes to evidence or quantities', async () => {
  const original = {
    schema_version: '2',
    items: [item({ search_aliases: { 'zh-CN': [], 'en-US': ['keyboard'] } })],
  } as ConsolidationOutput
  let rejected = false
  try {
    await validateConsolidationLocale(original, 'zh-CN', async () => ({
      data: {
        ...original,
        items: [item({
          search_aliases: { 'zh-CN': ['键盘'], 'en-US': ['keyboard'] },
          quantity: { kind: 'exact', value: 2 },
        })],
      },
      inputTokens: 1,
      outputTokens: 1,
      durationMs: 1,
    }))
  } catch (error) {
    rejected = error instanceof Error && error.message === 'packing_language_repair_changed_facts'
  }
  if (!rejected) throw new Error('language repair changed facts were accepted')
})

Deno.test('language repair catches Chinese descriptions and categories in an English result', async () => {
  const original = {
    schema_version: '2',
    items: [item({
      name: 'white power adapter',
      category: '电子设备',
      description: '白色电源适配器，用于电子设备供电。',
      instances: [{ ...item().instances[0]!, provisional_name: '白色电源适配器' }],
    })],
  } as ConsolidationOutput
  let repairCalls = 0
  const repaired = {
    ...original,
    items: [item({
      name: 'white power adapter',
      category: 'power accessories',
      description: 'White power adapter for electronic devices.',
      instances: [{ ...item().instances[0]!, provisional_name: 'white power adapter' }],
    })],
  } as ConsolidationOutput
  const result = await validateConsolidationLocale(original, 'en-US', async () => {
    repairCalls += 1
    return { data: repaired, inputTokens: 1, outputTokens: 1, durationMs: 1 }
  })
  if (repairCalls !== 1) throw new Error(`expected one repair call, got ${repairCalls}`)
  if (result.data.items[0]?.description !== 'White power adapter for electronic devices.') {
    throw new Error('English repair did not replace the Chinese description')
  }
})

function aliasJob(overrides: Partial<PackingSearchAliasJob> = {}): PackingSearchAliasJob {
  return {
    job_id: 'job-1',
    detected_item_id: 'item-1',
    session_id: 'session-1',
    name: 'keyboard',
    category: 'computer accessory',
    output_locale: 'zh-CN',
    attempts: 1,
    alias_version: 'packing-alias-v1',
    ...overrides,
  }
}

function fakeServices(rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return { database: { rpc }, qwenApiKey: 'test', qwenBaseUrl: 'https://example.invalid', qwenModel: 'test-model' } as unknown as PackingServices
}

Deno.test('historical alias jobs normalize model output before completing', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const services = fakeServices(async (name, args) => {
    calls.push({ name, args })
    return { data: null, error: null }
  })
  await processPackingSearchAliasJob(services, aliasJob(), async () => ({
    data: {
      schema_version: '2',
      search_aliases: { 'zh-CN': ['键盘', '键盘'], 'en-US': ['keyboard'] },
    },
    inputTokens: 1,
    outputTokens: 1,
    durationMs: 1,
  }))
  const completion = calls.find((call) => call.name === 'complete_packing_search_alias_job')
  if (!completion) throw new Error('alias completion RPC was not called')
  if (JSON.stringify(completion.args.p_search_aliases) !== JSON.stringify(['keyboard', '键盘'])) {
    throw new Error(`unexpected normalized aliases: ${JSON.stringify(completion.args.p_search_aliases)} expected ${JSON.stringify(['keyboard', '键盘'])} type=${typeof completion.args.p_search_aliases}`)
  }
  if (calls.some((call) => call.name.includes('session'))) throw new Error('alias job changed session state')
})

Deno.test('historical alias job failures use the isolated retry RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const services = fakeServices(async (name, args) => {
    calls.push({ name, args })
    return { data: null, error: null }
  })
  let threw = false
  try {
    await processPackingSearchAliasJob(services, aliasJob(), async () => {
      throw new Error('qwen_http_400')
    })
  } catch (error) {
    threw = error instanceof Error && error.message === 'qwen_http_400'
  }
  if (!threw) throw new Error('alias failure did not propagate a stable error code')
  const failure = calls.find((call) => call.name === 'fail_packing_search_alias_job')
  if (!failure) throw new Error('alias failure RPC was not called')
  if (calls.some((call) => call.name.includes('session'))) throw new Error('alias failure changed session state')
})

Deno.test('historical alias jobs reject output without the owner locale alias', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const services = fakeServices(async (name, args) => {
    calls.push({ name, args })
    return { data: null, error: null }
  })
  let threw = false
  try {
    await processPackingSearchAliasJob(services, aliasJob(), async () => ({
      data: { schema_version: '2', search_aliases: { 'zh-CN': [], 'en-US': ['keyboard'] } },
      inputTokens: 1,
      outputTokens: 1,
      durationMs: 1,
    }))
  } catch (error) {
    threw = error instanceof Error && error.message === 'packing_output_locale_invalid'
  }
  if (!threw) throw new Error('missing owner-locale alias was accepted')
  if (!calls.some((call) => call.name === 'fail_packing_search_alias_job')) {
    throw new Error('invalid alias output did not enter the isolated retry path')
  }
  if (calls.some((call) => call.name.includes('session'))) throw new Error('alias validation changed session state')
})
