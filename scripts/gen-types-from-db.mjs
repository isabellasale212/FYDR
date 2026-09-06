/* Generate src/lib/types/database.ts by introspecting the live Postgres schema directly,
 * without going through `supabase gen types`, which requires Docker/Podman on this machine
 * even in --db-url mode. This produces the same shape `@supabase/postgrest-js` expects
 * (GenericTable / GenericView / GenericSchema), so it is a drop-in replacement.
 *
 * Run with env vars loaded: `set -a && source .env.local && set +a && node scripts/gen-types-from-db.mjs`
 *
 * WHICH DATABASE. process.env.SUPABASE_DB_URL wins over the .env.local file, and
 * the host is printed before anything is written. This used to read the file and
 * nothing else, so `SUPABASE_DB_URL=<scratch> node scripts/gen-types-from-db.mjs`
 * silently introspected PRODUCTION instead and reported success -- the generated
 * types then described a schema that was not the one just migrated, and the only
 * symptom was a type error somewhere unrelated. Introspection is read-only, so
 * nothing was ever at risk, but "the env var I set was ignored" is the same shape
 * as the rule that test:tenancy must never point at production, and it should
 * fail loudly rather than quietly pick the other database.
 */

import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const dbUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('No SUPABASE_DB_URL, in the environment or in .env.local. Nothing written.');
  process.exit(1);
}
console.log(`Introspecting ${new URL(dbUrl).host} (${process.env.SUPABASE_DB_URL ? 'from the environment' : 'from .env.local'})`);

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

// ---------------------------------------------------------------------------
// 1. Enums
// ---------------------------------------------------------------------------

const enumRows = (
  await client.query(`
    select t.typname, e.enumlabel
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder;
  `)
).rows;

const enums = {}; // typname -> [labels]
for (const r of enumRows) {
  (enums[r.typname] ??= []).push(r.enumlabel);
}

// ---------------------------------------------------------------------------
// 1b. Functions (RPCs). PostgREST exposes every function in the `public`
// schema as an RPC, so `supabase gen types` includes all of them in
// `Functions`, and this generator matches that rather than curating a
// subset. Trigger functions are excluded: they return the `trigger`
// pseudo-type and are never callable via RPC. Extension-owned functions are
// excluded too: `citext` installs its comparison/regexp support functions
// straight into `public` (this schema does not give it its own schema), and
// several of those have unnamed, overloaded positional parameters that are
// not real named-arg RPCs and cannot be represented as one TS object type
// (found live: generation produced duplicate `null: T` keys and failed
// `tsc`). `pg_depend` with `deptype = 'e'` is Postgres's own record of
// "this object belongs to an extension", so this asks Postgres rather than
// guessing by name.
// ---------------------------------------------------------------------------

const extensionOwnedRows = (
  await client.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public';
  `)
).rows;
const extensionOwnedNames = new Set(extensionOwnedRows.map((r) => r.proname));

const functionRows = (
  await client.query(`
    select routine_name, specific_name, data_type, type_udt_name
    from information_schema.routines
    where routine_schema = 'public'
      and routine_type = 'FUNCTION'
      and data_type <> 'trigger'
    order by routine_name, specific_name;
  `)
).rows.filter((f) => !extensionOwnedNames.has(f.routine_name));

const functionParamRows = (
  await client.query(`
    select specific_name, parameter_name, parameter_mode, data_type, udt_name, ordinal_position,
           parameter_default
    from information_schema.parameters
    where specific_schema = 'public'
    order by specific_name, ordinal_position;
  `)
).rows;

const paramsBySpecificName = {};
for (const p of functionParamRows) {
  (paramsBySpecificName[p.specific_name] ??= []).push(p);
}

// Overloaded functions (same routine_name, different specific_name) collapse
// to their first-seen signature. None of this schema's own functions are
// overloaded today; documented rather than silently mishandled if one ever
// is added, since PostgREST itself does not support overloading on args.
const functionsByName = {};
for (const f of functionRows) {
  if (!functionsByName[f.routine_name]) functionsByName[f.routine_name] = f;
}

// ---------------------------------------------------------------------------
// 2. Tables and views
// ---------------------------------------------------------------------------

const tableRows = (
  await client.query(`
    select table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `)
).rows;

const columnRows = (
  await client.query(`
    select table_name, column_name, data_type, udt_name, is_nullable, column_default,
           ordinal_position
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position;
  `)
).rows;

const columnsByTable = {};
for (const c of columnRows) {
  (columnsByTable[c.table_name] ??= []).push(c);
}

const fkRows = (
  await client.query(`
    select
      tc.constraint_name,
      tc.table_name as source_table,
      kcu.column_name as source_column,
      kcu.ordinal_position as pos,
      ccu.table_name as referenced_table,
      ccu.column_name as referenced_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
    order by tc.constraint_name, kcu.ordinal_position;
  `)
).rows;

// Unique constraints (incl. PK), used to guess isOneToOne on single-column FKs.
const uniqueRows = (
  await client.query(`
    select tc.table_name, kcu.column_name, tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    where tc.constraint_type in ('PRIMARY KEY', 'UNIQUE') and tc.table_schema = 'public';
  `)
).rows;
const singleColUnique = new Set(); // "table.column" where that column alone is unique
{
  const byConstraint = {};
  for (const r of uniqueRows) {
    (byConstraint[r.constraint_name] ??= []).push(r);
  }
  for (const rows of Object.values(byConstraint)) {
    if (rows.length === 1) singleColUnique.add(`${rows[0].table_name}.${rows[0].column_name}`);
  }
}

const fksByConstraint = {};
for (const r of fkRows) {
  (fksByConstraint[r.constraint_name] ??= []).push(r);
}

const relationshipsByTable = {}; // table -> GenericRelationship[]
for (const [name, rows] of Object.entries(fksByConstraint)) {
  const sourceTable = rows[0].source_table;
  const relationship = {
    foreignKeyName: name,
    columns: rows.map((r) => r.source_column),
    referencedRelation: rows[0].referenced_table,
    referencedColumns: rows.map((r) => r.referenced_column),
    isOneToOne: rows.length === 1 && singleColUnique.has(`${sourceTable}.${rows[0].source_column}`),
  };
  (relationshipsByTable[sourceTable] ??= []).push(relationship);
}

// ---------------------------------------------------------------------------
// 3. Type mapping
// ---------------------------------------------------------------------------

function pgScalarToTs(udtName) {
  const name = udtName.replace(/^_/, ''); // arrays are prefixed with _ in udt_name
  if (enums[name]) return `Database["public"]["Enums"]["${name}"]`;
  switch (name) {
    case 'uuid':
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'citext':
    case 'char':
    case 'name':
    case 'date':
    case 'timestamp':
    case 'timestamptz':
    case 'time':
    case 'timetz':
    case 'interval':
    case 'inet':
    case 'cidr':
    case 'macaddr':
    case 'bytea':
      return 'string';
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
    case 'money':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'json':
    case 'jsonb':
      return 'Json';
    default:
      return 'unknown';
  }
}

function pgColumnToTs(col) {
  return pgUdtToTs(col.udt_name);
}

// Shared by table columns and function parameters/OUT columns alike — anything
// carrying a udt_name can be an array (uuid[] for resolve_nutrition_targets'
// p_athlete_ids, discovered when that function's Args typed the parameter as a
// bare string instead of string[], which typechecked fine and would have been
// wrong at every call site). pgColumnToTs used to inline this only for table
// columns; function parameters and OUT params called pgScalarToTs directly and
// silently dropped the array-ness.
function pgUdtToTs(udtName) {
  const isArray = udtName.startsWith('_');
  const base = pgScalarToTs(udtName);
  return isArray ? `${base}[]` : base;
}

// ---------------------------------------------------------------------------
// 4. Emit
// ---------------------------------------------------------------------------

function emitTable(name, cols, isView) {
  const rowLines = [];
  const insertLines = [];
  const updateLines = [];

  for (const col of cols) {
    const tsType = pgColumnToTs(col);
    const nullable = col.is_nullable === 'YES';
    const hasDefault = col.column_default !== null;
    const rowType = nullable ? `${tsType} | null` : tsType;

    rowLines.push(`        ${col.column_name}: ${rowType}`);

    if (!isView) {
      const optional = nullable || hasDefault;
      insertLines.push(`        ${col.column_name}${optional ? '?' : ''}: ${rowType}`);
      updateLines.push(`        ${col.column_name}?: ${rowType}`);
    }
  }

  let out = `    ${name}: {\n      Row: {\n${rowLines.join('\n')}\n      }\n`;
  if (!isView) {
    out += `      Insert: {\n${insertLines.join('\n')}\n      }\n`;
    out += `      Update: {\n${updateLines.join('\n')}\n      }\n`;
  }
  out += `      Relationships: [\n${(relationshipsByTable[name] ?? [])
    .map(
      (r) => `        {
          foreignKeyName: "${r.foreignKeyName}"
          columns: [${r.columns.map((c) => `"${c}"`).join(', ')}]
          isOneToOne: ${r.isOneToOne}
          referencedRelation: "${r.referencedRelation}"
          referencedColumns: [${r.referencedColumns.map((c) => `"${c}"`).join(', ')}]
        }`,
    )
    .join(',\n')}\n      ]\n`;
  out += `    }`;
  return out;
}

function emitFunction(fn) {
  // Belt and braces alongside the extension-owned filter above: a named-arg
  // RPC cannot have an unnamed parameter, so skip any that do rather than
  // emit unrepresentable output.
  const allParams = paramsBySpecificName[fn.specific_name] ?? [];
  const params = allParams.filter(
    (p) => (p.parameter_mode === 'IN' || p.parameter_mode === 'INOUT') && p.parameter_name !== null,
  );
  // A parameter with `default null` (resolve_programme_exercises' own
  // p_athlete_id is the case that surfaced this: an optional "which athlete"
  // argument, correct to omit AND correct to pass null explicitly) needs its
  // TS type to accept both. Postgres records that default as the literal
  // text "NULL::<type>" in parameter_default; anything else (a real default
  // value, or no default at all) leaves the argument required and non-null,
  // unchanged from before this was added.
  const argLines = params.map((p) => {
    const isNullDefault = typeof p.parameter_default === 'string' && /^null(::|$)/i.test(p.parameter_default.trim());
    const tsType = pgUdtToTs(p.udt_name);
    return isNullDefault
      ? `        ${p.parameter_name}?: ${tsType} | null`
      : `        ${p.parameter_name}: ${tsType}`;
  });
  // A zero-arg function (several of the auth_* helpers) would otherwise emit
  // a bare `{}`, which is "any non-nullish value" to eslint's
  // no-empty-object-type rule, not "no arguments" — the same fix already
  // applied to the empty top-level Functions type below.
  const argsType = params.length > 0 ? `{\n${argLines.join('\n')}\n      }` : 'Record<string, never>';

  // A `returns table (...)` or `returns setof ...` function (compute_leaderboard is
  // one) records its result columns as OUT parameters, not in routines.data_type,
  // which instead just says 'record' — unusable on its own. Build the row shape from
  // those OUT params and return an array of it, matching what postgrest-js expects
  // for a set-returning function and what Supabase's own generator produces.
  const outParams = allParams.filter((p) => p.parameter_mode === 'OUT' || p.parameter_mode === 'INOUT');
  let returnType;
  if (outParams.length > 0) {
    const rowLines = outParams.map((p) => `          ${p.parameter_name}: ${pgUdtToTs(p.udt_name)}`);
    returnType = `{\n${rowLines.join('\n')}\n        }[]`;
  } else {
    returnType =
      fn.data_type === 'USER-DEFINED' ? pgScalarToTs(fn.type_udt_name) : pgScalarToTs(fn.type_udt_name ?? fn.data_type);
  }

  return `    ${fn.routine_name}: {\n      Args: ${argsType}\n      Returns: ${returnType}\n    }`;
}

const tables = tableRows.filter((t) => t.table_type === 'BASE TABLE');
const views = tableRows.filter((t) => t.table_type === 'VIEW');

const tablesOut = tables
  .map((t) => emitTable(t.table_name, columnsByTable[t.table_name] ?? [], false))
  .join('\n');
const viewsOut = views
  .map((t) => emitTable(t.table_name, columnsByTable[t.table_name] ?? [], true))
  .join('\n');

const enumsOut = Object.entries(enums)
  .map(([name, labels]) => `    ${name}: ${labels.map((l) => `"${l}"`).join(' | ')}`)
  .join('\n');

const functionsOut = Object.values(functionsByName).map(emitFunction).join('\n');

const file = `// AUTO-GENERATED. Do not hand-edit.
//
// Generated by scripts/gen-types-from-db.mjs, which introspects the live Postgres schema
// directly via information_schema and pg_catalog. This stands in for
// \`supabase gen types typescript\`, which requires Docker/Podman even in --db-url mode and
// neither is available in this environment. Shape matches what \`supabase gen types\` produces
// and what @supabase/postgrest-js's GenericSchema / GenericTable / GenericView expect.
//
// Regenerate with:
//   set -a && source .env.local && set +a && node scripts/gen-types-from-db.mjs

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tablesOut}
    }
    Views: {
${viewsOut}
    }
    Functions: ${functionsOut ? `{\n${functionsOut}\n    }` : 'Record<string, never>'}
    Enums: {
${enumsOut}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience aliases used across the app. Kept in this file, not hand
// maintained elsewhere, so they move automatically when the schema does.
// ---------------------------------------------------------------------------

export type AppRole = Database["public"]["Enums"]["app_role"];
export type AvailabilityStatus = Database["public"]["Enums"]["availability_status"];
export type AvailabilityReason = Database["public"]["Enums"]["availability_reason"];
export type FlagSeverity = Database["public"]["Enums"]["flag_severity"];
export type BodyArea = Database["public"]["Enums"]["body_area"];
export type BodySide = Database["public"]["Enums"]["body_side"];
export type InjuryStatus = Database["public"]["Enums"]["injury_status"];
export type InjuryTimelineEventType = Database["public"]["Enums"]["injury_timeline_event_type"];
export type ComplianceDomain = Database["public"]["Enums"]["compliance_domain"];
export type AthleteStatus = Database["public"]["Enums"]["athlete_status"];
export type DominantSide = Database["public"]["Enums"]["dominant_side"];
export type FlagDomain = Database["public"]["Enums"]["flag_domain"];
export type ThresholdComparisonEnum = Database["public"]["Enums"]["threshold_comparison"];
export type BaselineTypeEnum = Database["public"]["Enums"]["baseline_type"];
export type InjurySeverity = Database["public"]["Enums"]["injury_severity"];
export type OccurrenceContext = Database["public"]["Enums"]["occurrence_context"];
export type ExerciseCategory = Database["public"]["Enums"]["exercise_category"];
export type ProgrammeType = Database["public"]["Enums"]["programme_type"];
export type ProgrammeStatus = Database["public"]["Enums"]["programme_status"];
export type LoadBasis = Database["public"]["Enums"]["load_basis"];
export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
export type GymLogStatus = Database["public"]["Enums"]["gym_log_status"];
export type OverrideType = Database["public"]["Enums"]["override_type"];
export type TestCategory = Database["public"]["Enums"]["test_category"];
export type SideMode = Database["public"]["Enums"]["side_mode"];
export type UserStatus = Database["public"]["Enums"]["user_status"];
export type OrgSport = Database["public"]["Enums"]["org_sport"];

export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type WellnessEntryRow = Database["public"]["Views"]["wellness_entries_current"]["Row"];
export type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
export type FixtureRow = Database["public"]["Tables"]["fixtures"]["Row"];
`;

writeFileSync('src/lib/types/database.ts', file);
console.log(`Wrote src/lib/types/database.ts: ${tables.length} tables, ${views.length} views, ${Object.keys(enums).length} enums, ${Object.keys(functionsByName).length} functions.`);

await client.end();
