import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/202608090002_venue_shared_content.sql'),
  'utf8',
)

function migrationFunction(name: string) {
  const start = migration.indexOf(`create function private.${name}()`)
  const end = migration.indexOf('\n$$;', start)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)

  return migration.slice(start, end)
}

describe('venue sharing migration direct-write contracts', () => {
  it('revokes direct item parent updates so moves must use move_item', () => {
    expect(migration).toMatch(
      /revoke update \(box_id\) on table public\.items from authenticated/,
    )
  })

  it('requires ownership of both venues for a direct space venue change', () => {
    const guard = migrationFunction('enforce_space_venue_owner')

    expect(guard).toMatch(
      /new\.venue_id is distinct from old\.venue_id[\s\S]*not public\.is_venue_owner\(old\.venue_id\)/,
    )
    expect(guard).toMatch(
      /new\.venue_id is distinct from old\.venue_id[\s\S]*not public\.is_venue_owner\(new\.venue_id\)/,
    )
  })

  it('requires ownership of both venues for a direct item box change', () => {
    const guard = migrationFunction('enforce_item_target_box')

    expect(guard).toMatch(
      /target_venue_id is distinct from old_venue_id[\s\S]*not public\.is_venue_owner\(old_venue_id\)[\s\S]*or not public\.is_venue_owner\(target_venue_id\)/,
    )
  })

  it('requires ownership of both venues for a direct layout space change', () => {
    const guard = migrationFunction('enforce_space_layout_owner')

    expect(guard).toMatch(
      /new\.space_id is distinct from old\.space_id[\s\S]*not public\.is_venue_owner\(old_venue_id\)/,
    )
    expect(guard).toMatch(
      /new\.space_id is distinct from old\.space_id[\s\S]*not public\.is_venue_owner\(target_venue_id\)/,
    )
  })
})
