import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/202608090002_venue_shared_content.sql'),
  'utf8',
)
const workflowMigration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/202608090003_venue_shared_workflows.sql'),
  'utf8',
)
const reusableInviteMigration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/202608090006_reusable_venue_invites.sql'),
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

describe('venue shared workflow SQL contracts', () => {
  it('loads composite item rows with SELECT items.* before reading venue ids', () => {
    expect(workflowMigration).not.toMatch(
      /select items, spaces\.venue_id into current_item, source_venue_id/i,
    )
    expect(workflowMigration.match(/select items\.\*\s+into current_item/gi)).toHaveLength(3)
  })
})

describe('reusable venue invite migration contracts', () => {
  it('keeps only the newest active legacy invite and audits older revocations', () => {
    expect(reusableInviteMigration).toMatch(
      /row_number\(\)\s+over\s*\(\s*partition by invites\.venue_id\s+order by invites\.created_at desc, invites\.id desc\s*\)/i,
    )
    expect(reusableInviteMigration).toMatch(
      /update public\.venue_invites[\s\S]*set revoked_at[\s\S]*from legacy_active[\s\S]*invite_rank\s*>\s*1/i,
    )
    expect(reusableInviteMigration).toMatch(
      /event_code\s*\)\s*select[\s\S]*'invite_revoked'/i,
    )
  })

  it('backfills accepted legacy invites into the private acceptance history', () => {
    expect(reusableInviteMigration).toMatch(
      /insert into private\.venue_invite_acceptances[\s\S]*select invites\.id, invites\.accepted_by, invites\.accepted_at/i,
    )
  })
})
