import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const spaceRoleEnum = pgEnum("space_role", ["owner", "admin", "member"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "invite",
  "role_change",
  "settings_change",
]);

// ---------------------------------------------------------------------------
// NextAuth tables (Story 1.2)
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: text("role").default("user").notNull(), // user | superadmin
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ---------------------------------------------------------------------------
// Spaces (Story 2.1)
// ---------------------------------------------------------------------------

export const spaces = pgTable(
  "space",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    settings: jsonb("settings").default({}).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (space) => [uniqueIndex("space_slug_idx").on(space.slug)]
);

// ---------------------------------------------------------------------------
// Space Membership (Story 2.2)
// ---------------------------------------------------------------------------

export const spaceMembers = pgTable(
  "space_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: spaceRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (sm) => [
    uniqueIndex("space_member_unique_idx").on(sm.spaceId, sm.userId),
    index("space_member_space_idx").on(sm.spaceId),
    index("space_member_user_idx").on(sm.userId),
  ]
);

export const spaceInvitations = pgTable(
  "space_invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: spaceRoleEnum("role").default("member").notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (si) => [
    index("space_invitation_email_idx").on(si.email),
    index("space_invitation_space_idx").on(si.spaceId),
  ]
);

// ---------------------------------------------------------------------------
// Tags (Story 4.1)
// ---------------------------------------------------------------------------

export const tags = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color").default("#6366f1"),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (tag) => [
    uniqueIndex("tag_name_space_idx").on(tag.name, tag.spaceId),
    index("tag_space_idx").on(tag.spaceId),
  ]
);

export const memoryTags = pgTable(
  "memory_tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryId: text("memory_id").notNull(), // Mem0 UUID
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (mt) => [
    uniqueIndex("memory_tag_unique_idx").on(mt.memoryId, mt.tagId),
    index("memory_tag_memory_idx").on(mt.memoryId),
    index("memory_tag_tag_idx").on(mt.tagId),
  ]
);

// ---------------------------------------------------------------------------
// Bookmarks (Story 4.2)
// ---------------------------------------------------------------------------

export const memoryBookmarks = pgTable(
  "memory_bookmark",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryId: text("memory_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    priority: integer("priority").default(0).notNull(), // 0=normal, 1=important, 2=critical
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (mb) => [
    uniqueIndex("memory_bookmark_unique_idx").on(mb.memoryId, mb.userId),
    index("memory_bookmark_user_idx").on(mb.userId),
  ]
);

// ---------------------------------------------------------------------------
// Annotations (Story 4.3)
// ---------------------------------------------------------------------------

export const memoryAnnotations = pgTable(
  "memory_annotation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryId: text("memory_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (ma) => [
    index("memory_annotation_memory_idx").on(ma.memoryId),
    index("memory_annotation_user_idx").on(ma.userId),
  ]
);

// ---------------------------------------------------------------------------
// Audit Log (Story 5.3)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: auditActionEnum("action").notNull(),
    resourceType: text("resource_type").notNull(), // memory, space, user, tag, etc.
    resourceId: text("resource_id"),
    spaceId: uuid("space_id").references(() => spaces.id, {
      onDelete: "set null",
    }),
    details: jsonb("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (al) => [
    index("audit_log_user_idx").on(al.userId),
    index("audit_log_space_idx").on(al.spaceId),
    index("audit_log_action_idx").on(al.action),
    index("audit_log_created_idx").on(al.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Kanban (Story 6.4)
// ---------------------------------------------------------------------------

export const kanbanBoards = pgTable(
  "kanban_board",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (kb) => [index("kanban_board_space_idx").on(kb.spaceId)]
);

export const kanbanColumns = pgTable(
  "kanban_column",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    color: text("color"),
  },
  (kc) => [index("kanban_column_board_idx").on(kc.boardId)]
);

export const kanbanCards = pgTable(
  "kanban_card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    columnId: uuid("column_id")
      .notNull()
      .references(() => kanbanColumns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (kcard) => [index("kanban_card_column_idx").on(kcard.columnId)]
);

export const kanbanCardMemories = pgTable(
  "kanban_card_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => kanbanCards.id, { onDelete: "cascade" }),
    memoryId: text("memory_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (kcm) => [
    uniqueIndex("kanban_card_memory_unique_idx").on(kcm.cardId, kcm.memoryId),
  ]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  spaceMemberships: many(spaceMembers),
  createdSpaces: many(spaces),
  bookmarks: many(memoryBookmarks),
  annotations: many(memoryAnnotations),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [spaces.createdBy],
    references: [users.id],
  }),
  members: many(spaceMembers),
  invitations: many(spaceInvitations),
  tags: many(tags),
  kanbanBoards: many(kanbanBoards),
  auditLogs: many(auditLogs),
}));

export const spaceMembersRelations = relations(spaceMembers, ({ one }) => ({
  space: one(spaces, {
    fields: [spaceMembers.spaceId],
    references: [spaces.id],
  }),
  user: one(users, {
    fields: [spaceMembers.userId],
    references: [users.id],
  }),
}));

export const spaceInvitationsRelations = relations(
  spaceInvitations,
  ({ one }) => ({
    space: one(spaces, {
      fields: [spaceInvitations.spaceId],
      references: [spaces.id],
    }),
    inviter: one(users, {
      fields: [spaceInvitations.invitedBy],
      references: [users.id],
    }),
  })
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
  space: one(spaces, {
    fields: [tags.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [tags.createdBy],
    references: [users.id],
  }),
  memoryTags: many(memoryTags),
}));

export const memoryTagsRelations = relations(memoryTags, ({ one }) => ({
  tag: one(tags, {
    fields: [memoryTags.tagId],
    references: [tags.id],
  }),
}));

export const kanbanBoardsRelations = relations(
  kanbanBoards,
  ({ one, many }) => ({
    space: one(spaces, {
      fields: [kanbanBoards.spaceId],
      references: [spaces.id],
    }),
    creator: one(users, {
      fields: [kanbanBoards.createdBy],
      references: [users.id],
    }),
    columns: many(kanbanColumns),
  })
);

export const kanbanColumnsRelations = relations(
  kanbanColumns,
  ({ one, many }) => ({
    board: one(kanbanBoards, {
      fields: [kanbanColumns.boardId],
      references: [kanbanBoards.id],
    }),
    cards: many(kanbanCards),
  })
);

export const kanbanCardsRelations = relations(
  kanbanCards,
  ({ one, many }) => ({
    column: one(kanbanColumns, {
      fields: [kanbanCards.columnId],
      references: [kanbanColumns.id],
    }),
    assignee: one(users, {
      fields: [kanbanCards.assigneeId],
      references: [users.id],
    }),
    creator: one(users, {
      fields: [kanbanCards.createdBy],
      references: [users.id],
    }),
    memories: many(kanbanCardMemories),
  })
);

export const kanbanCardMemoriesRelations = relations(
  kanbanCardMemories,
  ({ one }) => ({
    card: one(kanbanCards, {
      fields: [kanbanCardMemories.cardId],
      references: [kanbanCards.id],
    }),
  })
);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type SpaceMember = typeof spaceMembers.$inferSelect;
export type SpaceInvitation = typeof spaceInvitations.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type MemoryTag = typeof memoryTags.$inferSelect;
export type MemoryBookmark = typeof memoryBookmarks.$inferSelect;
export type MemoryAnnotation = typeof memoryAnnotations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type KanbanCard = typeof kanbanCards.$inferSelect;
