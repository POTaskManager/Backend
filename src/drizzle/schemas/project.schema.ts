import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * PROJECT DATABASE SCHEMA
 * Each project has its own database with this structure
 */

// ============================================
// STATUS TYPES
// ============================================
export const statusTypes = pgTable('statustypes', {
  typeId: integer('stattype_typeid').primaryKey(),
  description: varchar('stattype_description', { length: 255 }),
  createdAt: timestamp('stattype_created_at').defaultNow(),
});

// ============================================
// COLUMNS (Kanban Board)
// ============================================
export const columns = pgTable(
  'columns',
  {
    id: uuid('col_columnid').primaryKey().defaultRandom(),
    name: varchar('col_name', { length: 100 }).notNull(),
    order: integer('col_order').notNull().unique(),
    createdAt: timestamp('col_created_at').defaultNow(),
  },
  (table) => ({
    orderIdx: uniqueIndex('idx_columns_col_order').on(table.order),
  })
);

export const columnsRelations = relations(columns, ({ many }) => ({
  statuses: many(statuses),
}));

// ============================================
// STATUSES (Task States)
// ============================================
export const statuses = pgTable(
  'statuses',
  {
    id: uuid('stat_statusid').primaryKey().defaultRandom(),
    name: varchar('stat_name', { length: 100 }).notNull(),
    typeId: integer('stat_typeid')
      .notNull()
      .references(() => statusTypes.typeId, { onDelete: 'cascade' }),
    columnId: uuid('stat_columnid').references(() => columns.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('stat_created_at').defaultNow(),
  },
  (table) => ({
    typeIdx: index('idx_statuses_typeid').on(table.typeId),
    columnIdx: index('idx_statuses_columnid').on(table.columnId),
  })
);

export const statusesRelations = relations(statuses, ({ one, many }) => ({
  type: one(statusTypes, {
    fields: [statuses.typeId],
    references: [statusTypes.typeId],
  }),
  column: one(columns, {
    fields: [statuses.columnId],
    references: [columns.id],
  }),
  tasks: many(tasks),
  transitionsFrom: many(statusTransitions, { relationName: 'fromStatus' }),
  transitionsTo: many(statusTransitions, { relationName: 'toStatus' }),
}));

// ============================================
// STATUS TRANSITIONS (Workflow)
// ============================================
export const statusTransitions = pgTable(
  'status_transitions',
  {
    id: uuid('st_id').primaryKey().defaultRandom(),
    fromStatusId: uuid('st_from_statusid').references(() => statuses.id, {
      onDelete: 'cascade',
    }),
    toStatusId: uuid('st_to_statusid').references(() => statuses.id, {
      onDelete: 'cascade',
    }),
  },
  (table) => ({
    fromIdx: index('idx_status_transitions_from').on(table.fromStatusId),
    toIdx: index('idx_status_transitions_to').on(table.toStatusId),
  })
);

export const statusTransitionsRelations = relations(
  statusTransitions,
  ({ one }) => ({
    fromStatus: one(statuses, {
      fields: [statusTransitions.fromStatusId],
      references: [statuses.id],
      relationName: 'fromStatus',
    }),
    toStatus: one(statuses, {
      fields: [statusTransitions.toStatusId],
      references: [statuses.id],
      relationName: 'toStatus',
    }),
  })
);

// ============================================
// LABELS
// ============================================
export const labels = pgTable('labels', {
  id: uuid('lab_labelid').primaryKey().defaultRandom(),
  name: varchar('lab_name', { length: 100 }).notNull(),
  color: varchar('lab_color', { length: 20 }),
  createdAt: timestamp('lab_created_at').defaultNow(),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  taskLabels: many(taskLabels),
}));

// ============================================
// REFERENCE TYPES
// ============================================
export const referenceTypes = pgTable('referencetypes', {
  rtId: integer('rt_rtid').primaryKey(),
  name: varchar('rt_name', { length: 100 }).notNull(),
});

export const referenceTypesRelations = relations(referenceTypes, ({ many }) => ({
  fileReferences: many(fileReferences),
}));

// ============================================
// CHAT CONTAINERS
// ============================================
export const chatContainers = pgTable('chatcontainers', {
  id: uuid('chat_chatid').primaryKey().defaultRandom(),
  name: varchar('chat_name', { length: 255 }),
  createdBy: uuid('chat_created_by').notNull(),
  createdAt: timestamp('chat_created_at').defaultNow(),
});

export const chatContainersRelations = relations(
  chatContainers,
  ({ many }) => ({
    messages: many(chatMessages),
  })
);

// ============================================
// CHAT MESSAGES
// ============================================
export const chatMessages = pgTable(
  'chatmessages',
  {
    id: uuid('chm_messageid').primaryKey().defaultRandom(),
    chatId: uuid('chm_chatid').references(() => chatContainers.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('chm_userid').notNull(),
    message: text('chm_message').notNull(),
    createdAt: timestamp('chm_created_at').defaultNow(),
  },
  (table) => ({
    chatIdx: index('idx_chat_messages_chat').on(table.chatId),
    userIdx: index('idx_chat_messages_user').on(table.userId),
  })
);

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    chatContainer: one(chatContainers, {
      fields: [chatMessages.chatId],
      references: [chatContainers.id],
    }),
    lastReads: many(chatLastReads),
  })
);

// ============================================
// CHAT LAST READS
// ============================================
export const chatLastReads = pgTable(
  'chat_last_reads',
  {
    chatId: uuid('chat_id').notNull().primaryKey(),
    userId: uuid('user_id').notNull().primaryKey(),
    lastReadMessageId: uuid('last_read_messageid').references(
      () => chatMessages.id,
      { onDelete: 'set null' }
    ),
    lastReadAt: timestamp('last_read_at'),
  },
  (table) => ({
    chatIdx: index('idx_clr_chat').on(table.chatId),
    userIdx: index('idx_clr_user').on(table.userId),
  })
);

export const chatLastReadsRelations = relations(chatLastReads, ({ one }) => ({
  lastReadMessage: one(chatMessages, {
    fields: [chatLastReads.lastReadMessageId],
    references: [chatMessages.id],
  }),
}));

// ============================================
// SPRINTS
// ============================================
export const sprints = pgTable(
  'sprints',
  {
    id: uuid('spr_sprintid').primaryKey().defaultRandom(),
    name: varchar('spr_name', { length: 255 }).notNull(),
    startDate: timestamp('spr_start_date'),
    endDate: timestamp('spr_end_date'),
    statusId: uuid('spr_statusid').references(() => statuses.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('spr_created_at').defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_sprints_status').on(table.statusId),
  })
);

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  status: one(statuses, {
    fields: [sprints.statusId],
    references: [statuses.id],
  }),
  tasks: many(tasks),
}));

// ============================================
// FILES
// ============================================
export const files = pgTable('files', {
  id: uuid('fil_fileid').primaryKey().defaultRandom(),
  name: varchar('fil_name', { length: 255 }).notNull(),
  url: text('fil_url').notNull(),
  uploadedBy: uuid('fil_uploaded_by').notNull(),
  createdAt: timestamp('fil_created_at').defaultNow(),
});

export const filesRelations = relations(files, ({ many }) => ({
  references: many(fileReferences),
}));

// ============================================
// FILE REFERENCES
// ============================================
export const fileReferences = pgTable(
  'filereferences',
  {
    id: uuid('fr_id').primaryKey().defaultRandom(),
    fileId: uuid('fr_fileid').references(() => files.id, {
      onDelete: 'cascade',
    }),
    referenceTypeId: integer('fr_referencetypeid').references(
      () => referenceTypes.rtId
    ),
    referenceId: uuid('fr_referenceid').notNull(),
    createdAt: timestamp('fr_created_at').defaultNow(),
    editedAt: timestamp('fr_edited_at'),
    note: text('fr_note'),
  },
  (table) => ({
    fileIdx: index('idx_file_references_file').on(table.fileId),
    refIdx: index('idx_file_references_ref').on(table.referenceId),
  })
);

export const fileReferencesRelations = relations(
  fileReferences,
  ({ one }) => ({
    file: one(files, {
      fields: [fileReferences.fileId],
      references: [files.id],
    }),
    referenceType: one(referenceTypes, {
      fields: [fileReferences.referenceTypeId],
      references: [referenceTypes.rtId],
    }),
  })
);

// ============================================
// TASKS
// ============================================
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('task_taskid').primaryKey().defaultRandom(),
    title: varchar('task_title', { length: 255 }).notNull(),
    description: text('task_description'),
    createdAt: timestamp('task_created_at').defaultNow(),
    updatedAt: timestamp('task_updated_at').defaultNow(),
    statusId: uuid('task_statusid').references(() => statuses.id, {
      onDelete: 'set null',
    }),
    sprintId: uuid('task_sprintid').references(() => sprints.id, {
      onDelete: 'set null',
    }),
    createdBy: uuid('task_created_by').notNull(),
    priority: integer('task_priority'),
    dueAt: timestamp('task_due_at'),
    assignedTo: uuid('task_assigned_to'),
    estimate: integer('task_estimate'),
    archived: boolean('task_archived').default(false),
  },
  (table) => ({
    statusIdx: index('idx_tasks_status').on(table.statusId),
    sprintIdx: index('idx_tasks_sprint').on(table.sprintId),
    assignedToIdx: index('idx_tasks_assigned_to').on(table.assignedTo),
    dueAtIdx: index('idx_tasks_due_at').on(table.dueAt),
  })
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  status: one(statuses, {
    fields: [tasks.statusId],
    references: [statuses.id],
  }),
  sprint: one(sprints, {
    fields: [tasks.sprintId],
    references: [sprints.id],
  }),
  labels: many(taskLabels),
  contributors: many(taskContributors),
  comments: many(comments),
  audits: many(taskAudits),
}));

// ============================================
// TASK LABELS (Many-to-Many)
// ============================================
export const taskLabels = pgTable(
  'tasklabels',
  {
    id: uuid('tl_id').primaryKey().defaultRandom(),
    taskId: uuid('tl_taskid')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: uuid('tl_labelid')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    taskIdx: index('idx_tasklabels_task').on(table.taskId),
    labelIdx: index('idx_tasklabels_label').on(table.labelId),
  })
);

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLabels.taskId],
    references: [tasks.id],
  }),
  label: one(labels, {
    fields: [taskLabels.labelId],
    references: [labels.id],
  }),
}));

// ============================================
// TASK CONTRIBUTORS
// ============================================
export const taskContributors = pgTable(
  'taskcontributors',
  {
    id: uuid('tuc_id').primaryKey().defaultRandom(),
    taskId: uuid('tuc_taskid').references(() => tasks.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('tuc_userid').notNull(),
    role: varchar('tuc_role', { length: 50 }),
    createdAt: timestamp('tuc_created_at').defaultNow(),
  },
  (table) => ({
    taskIdx: index('idx_taskcontributors_task').on(table.taskId),
    userIdx: index('idx_taskcontributors_user').on(table.userId),
  })
);

export const taskContributorsRelations = relations(
  taskContributors,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskContributors.taskId],
      references: [tasks.id],
    }),
  })
);

// ============================================
// COMMENTS
// ============================================
export const comments = pgTable(
  'comments',
  {
    id: uuid('com_commentid').primaryKey().defaultRandom(),
    taskId: uuid('com_taskid').references(() => tasks.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('com_userid').notNull(),
    content: text('com_content').notNull(),
    createdAt: timestamp('com_created_at').defaultNow(),
    editedAt: timestamp('com_edited_at'),
  },
  (table) => ({
    taskIdx: index('idx_comments_task').on(table.taskId),
    userIdx: index('idx_comments_user').on(table.userId),
  })
);

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
}));

// ============================================
// TASK AUDIT
// ============================================
export const taskAudits = pgTable(
  'task_audit',
  {
    id: uuid('audit_id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').references(() => tasks.id, {
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
    taskIdx: index('idx_task_audit_task').on(table.taskId),
  })
);

export const taskAuditsRelations = relations(taskAudits, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAudits.taskId],
    references: [tasks.id],
  }),
}));

// ============================================
// TASK AUDIT ARCHIVE
// ============================================
export const taskAuditArchives = pgTable(
  'task_audit_archive',
  {
    id: uuid('audit_id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').references(() => tasks.id, {
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
    taskIdx: index('idx_task_audit_archive_task').on(table.taskId),
  })
);

export const taskAuditArchivesRelations = relations(
  taskAuditArchives,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAuditArchives.taskId],
      references: [tasks.id],
    }),
  })
);
