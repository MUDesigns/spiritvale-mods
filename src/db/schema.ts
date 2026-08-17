import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const mods = pgTable("mods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: text("owner_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const modVersions = pgTable(
  "mod_versions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    modId: text("mod_id")
      .notNull()
      .references(() => mods.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    changelog: text("changelog"),
    filename: text("filename").notNull(),
    sha256: text("sha256").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    downloadUrl: text("download_url").notNull(),
    blobPath: text("blob_path").notNull(),
    status: text("status").notNull(),
    scanSummary: text("scan_summary"),
    vtId: text("vt_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    uploaderUserId: text("uploader_user_id"),
  },
  (table) => [
    uniqueIndex("mod_versions_mod_id_version").on(table.modId, table.version),
    index("mod_versions_status").on(table.status),
  ],
);

export const appRelease = pgTable("app_release", {
  id: integer("id").primaryKey(),
  version: text("version").notNull(),
  changelog: text("changelog"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  installerFilename: text("installer_filename"),
  installerSha256: text("installer_sha256"),
  installerSizeBytes: bigint("installer_size_bytes", { mode: "number" }),
  installerDownloadUrl: text("installer_download_url"),
  portableFilename: text("portable_filename"),
  portableSha256: text("portable_sha256"),
  portableSizeBytes: bigint("portable_size_bytes", { mode: "number" }),
  portableDownloadUrl: text("portable_download_url"),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    last4: text("last4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("api_keys_key_hash").on(table.keyHash),
    index("api_keys_user_id").on(table.userId),
  ],
);

export const publishEvents = pgTable(
  "publish_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("publish_events_user_created").on(table.userId, table.createdAt)],
);

export const catalogAdmins = pgTable("catalog_admins", {
  email: text("email").primaryKey(),
  grantedByUserId: text("granted_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
