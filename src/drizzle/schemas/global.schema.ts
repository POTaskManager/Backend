import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  inet,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * GLOBAL DATABASE SCHEMA
 * Contains: Users, Projects, Sessions, Roles
 */

// ============================================
// ROLES
// ============================================
export const roles = pgTable('roles', {
  id: uuid('role_roleid').primaryKey().defaultRandom(),
  name: varchar('role_name', { length: 100 }).notNull(),
});

// ============================================
// USERS
// ============================================
export const users = pgTable(
  'users',
  {
    id: uuid('user_userid').primaryKey().defaultRandom(),
    email: varchar('user_email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('user_password_hash', { length: 255 }).notNull(),
    name: varchar('user_name', { length: 100 }),
    createdAt: timestamp('user_created_at').defaultNow(),
    emailVerified: boolean('user_email_verified').default(false),
    lastLogin: timestamp('last_login'),
    isActive: boolean('is_active').default(true),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    emailIdx: uniqueIndex('idx_users_email').on(table.email),
  })
);

export const usersRelations = relations(users, ({ many, one }) => ({
  userSettings: one(userSettings),
  identities: many(userIdentities),
  sessions: many(sessions),
  projects: many(projects),
  projectAccess: many(projectAccess),
  userAudit: many(userAudit),
}));

// ============================================
// USER SETTINGS
// ============================================
export const userSettings = pgTable('usersettings', {
  id: uuid('uset_settingsid').primaryKey().defaultRandom(),
  userId: uuid('uset_userid').references(() => users.id, {
    onDelete: 'cascade',
  }),
  theme: varchar('uset_theme', { length: 50 }),
  language: varchar('uset_language', { length: 10 }),
  notificationsEnabled: boolean('uset_notifications_enabled').default(true),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// ============================================
// USER IDENTITIES (OAuth)
// ============================================
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('identity_id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 100 }).notNull(),
    providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),
    providerEmail: varchar('provider_email', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow(),
    emailVerified: boolean('email_verified').default(false),
    displayName: varchar('display_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
  },
  (table) => ({
    providerUserIdIdx: uniqueIndex('user_identities_provider_userid_key').on(
      table.provider,
      table.providerUserId
    ),
  })
);

export const userIdentitiesRelations = relations(
  userIdentities,
  ({ one }) => ({
    user: one(users, {
      fields: [userIdentities.userId],
      references: [users.id],
    }),
  })
);

// ============================================
// SESSIONS
// ============================================
export const sessions = pgTable('sessions', {
  id: uuid('session_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash'),
  expiresAt: timestamp('expires_at'),
  lastSeenAt: timestamp('last_seen_at'),
  revoked: boolean('revoked').default(false),
  userAgent: text('user_agent'),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
  meta: jsonb('meta'),
});

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  blacklistedTokens: many(refreshTokenBlacklist),
}));

// ============================================
// REFRESH TOKEN BLACKLIST
// ============================================
export const refreshTokenBlacklist = pgTable(
  'refresh_token_blacklist',
  {
    tokenHash: text('token_hash').primaryKey(),
    sessionId: uuid('session_id').references(() => sessions.id, {
      onDelete: 'cascade',
    }),
    blacklistedAt: timestamp('blacklisted_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    reason: text('reason'),
  },
  (table) => ({
    sessionIdIdx: index('idx_refresh_token_blacklist_session').on(
      table.sessionId
    ),
  })
);

export const refreshTokenBlacklistRelations = relations(
  refreshTokenBlacklist,
  ({ one }) => ({
    session: one(sessions, {
      fields: [refreshTokenBlacklist.sessionId],
      references: [sessions.id],
    }),
  })
);

// ============================================
// PROJECTS
// ============================================
export const projects = pgTable(
  'projects',
  {
    id: uuid('proj_projid').primaryKey().defaultRandom(),
    name: varchar('proj_name', { length: 255 }).notNull(),
    dbNamespace: varchar('proj_db_namespace', { length: 255 }).notNull().unique(),
    createdBy: uuid('proj_created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('proj_created_at').defaultNow(),
    description: text('proj_description'),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    createdByIdx: index('idx_projects_created_by').on(table.createdBy),
    namespaceIdx: uniqueIndex('idx_projects_namespace').on(table.dbNamespace),
  })
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  projectAccess: many(projectAccess),
  projectAccessAudit: many(projectAccessAudit),
}));

// ============================================
// PROJECT ACCESS (RBAC)
// ============================================
export const projectAccess = pgTable(
  'projectaccess',
  {
    id: uuid('pac_accessid').primaryKey().defaultRandom(),
    userId: uuid('pac_userid')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('pac_projectid')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: varchar('pac_role', { length: 50 }),
    invitedAt: timestamp('pac_invited_at'),
    accepted: boolean('pac_accepted').default(false),
    createdAt: timestamp('pac_created_at').defaultNow(),
    roleId: uuid('pac_role_id').references(() => roles.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    projectIdx: index('idx_projectaccess_project').on(table.projectId),
    userIdx: index('idx_projectaccess_user').on(table.userId),
  })
);

export const projectAccessRelations = relations(
  projectAccess,
  ({ one }) => ({
    user: one(users, {
      fields: [projectAccess.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [projectAccess.projectId],
      references: [projects.id],
    }),
    role: one(roles, {
      fields: [projectAccess.roleId],
      references: [roles.id],
    }),
  })
);

// ============================================
// USER AUDIT
// ============================================
export const userAudit = pgTable(
  'user_audit',
  {
    id: uuid('audit_id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    operation: varchar('operation', { length: 20 }),
    changedBy: uuid('changed_by'),
    changedAt: timestamp('changed_at').defaultNow(),
    changedFields: jsonb('changed_fields'),
    old: jsonb('old'),
    new: jsonb('new'),
  },
  (table) => ({
    userIdx: index('idx_user_audit_user').on(table.userId),
  })
);

export const userAuditRelations = relations(userAudit, ({ one }) => ({
  user: one(users, {
    fields: [userAudit.userId],
    references: [users.id],
  }),
}));

// ============================================
// PROJECT ACCESS AUDIT
// ============================================
export const projectAccessAudit = pgTable(
  'projectaccess_audit',
  {
    id: uuid('audit_id').primaryKey().defaultRandom(),
    pacAccessId: uuid('pac_accessid'),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    operation: varchar('operation', { length: 20 }),
    changedBy: uuid('changed_by'),
    changedAt: timestamp('changed_at').defaultNow(),
    changedFields: jsonb('changed_fields'),
    old: jsonb('old'),
    new: jsonb('new'),
  },
  (table) => ({
    projectIdx: index('idx_pac_audit_project').on(table.projectId),
    userIdx: index('idx_pac_audit_user').on(table.userId),
  })
);

export const projectAccessAuditRelations = relations(
  projectAccessAudit,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectAccessAudit.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [projectAccessAudit.userId],
      references: [users.id],
    }),
  })
);

// ============================================
// NOTIFICATION PREFERENCES
// ============================================
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('np_id').primaryKey().defaultRandom(),
    userId: uuid('np_userid')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailEnabled: boolean('np_email_enabled').default(true),
    pushEnabled: boolean('np_push_enabled').default(false),
    events: jsonb('np_events').$type<Record<string, boolean>>().default({
      'task.created': false,
      'task.assigned': true,
      'task.updated': true,
      'task.status_changed': true,
      'task.commented': true,
      'task.deleted': true,
      'sprint.created': false,
      'sprint.started': true,
      'sprint.completed': true,
      'sprint.task_added': false,
      'comment.created': true,
      'comment.mentioned': true,
      'chat.mentioned': true,
    }),
    createdAt: timestamp('np_created_at').defaultNow(),
    updatedAt: timestamp('np_updated_at').defaultNow(),
  },
  (table) => ({
    userIdxUnique: uniqueIndex('idx_notification_prefs_user').on(table.userId),
  })
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

// ============================================
// NOTIFICATION LOGS
// ============================================
export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: uuid('nl_id').primaryKey().defaultRandom(),
    userId: uuid('nl_userid')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: varchar('nl_event_type', { length: 100 }).notNull(),
    eventData: jsonb('nl_event_data').$type<Record<string, any>>(),
    status: varchar('nl_status', { length: 20 }).notNull(), // 'pending' | 'sent' | 'failed' | 'skipped'
    channel: varchar('nl_channel', { length: 20 }).notNull(), // 'email' | 'push'
    errorMessage: text('nl_error_message'),
    sentAt: timestamp('nl_sent_at'),
    createdAt: timestamp('nl_created_at').defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_notification_logs_user').on(
      table.userId,
      table.createdAt
    ),
    statusIdx: index('idx_notification_logs_status').on(
      table.status,
      table.createdAt
    ),
    eventIdx: index('idx_notification_logs_event').on(table.eventType),
  })
);

export const notificationLogsRelations = relations(
  notificationLogs,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationLogs.userId],
      references: [users.id],
    }),
  })
);
