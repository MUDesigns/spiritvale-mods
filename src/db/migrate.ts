import { getSql } from "./index";

let migrated = false;

export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS mods (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text,
      owner_user_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE mods ADD COLUMN IF NOT EXISTS description text`;
  await sql`ALTER TABLE mods ADD COLUMN IF NOT EXISTS thumbnail_image_id text`;
  await sql`ALTER TABLE mods ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE mods ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS mods_hidden ON mods (hidden)`;
  await sql`
    CREATE TABLE IF NOT EXISTS mod_images (
      id text PRIMARY KEY,
      mod_id text NOT NULL REFERENCES mods(id) ON DELETE CASCADE,
      url text NOT NULL,
      blob_path text NOT NULL,
      filename text NOT NULL,
      size_bytes bigint NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      source_url text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS mod_images_mod_id ON mod_images (mod_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mod_images_blob_path ON mod_images (blob_path)`;
  await sql`
    CREATE TABLE IF NOT EXISTS mod_versions (
      id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      mod_id text NOT NULL REFERENCES mods(id) ON DELETE CASCADE,
      version text NOT NULL,
      changelog text,
      filename text NOT NULL,
      sha256 text NOT NULL,
      size_bytes bigint NOT NULL,
      download_url text NOT NULL,
      blob_path text NOT NULL,
      status text NOT NULL,
      scan_summary text,
      vt_id text,
      published_at timestamptz NOT NULL,
      uploader_user_id text
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS mod_versions_mod_id_version
    ON mod_versions (mod_id, version)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS mod_versions_status ON mod_versions (status)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_release (
      id integer PRIMARY KEY,
      version text NOT NULL,
      changelog text,
      published_at timestamptz NOT NULL,
      installer_filename text,
      installer_sha256 text,
      installer_size_bytes bigint,
      installer_download_url text,
      portable_filename text,
      portable_sha256 text,
      portable_size_bytes bigint,
      portable_download_url text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS publish_events (
      id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS publish_events_user_created
    ON publish_events (user_id, created_at)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      name text NOT NULL,
      key_hash text NOT NULL,
      last4 text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at timestamptz
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash ON api_keys (key_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS api_keys_user_id ON api_keys (user_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS catalog_admins (
      email text PRIMARY KEY,
      granted_by_user_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  migrated = true;
}
