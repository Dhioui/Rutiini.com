import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Municipalities (Helsinki, Espoo, Vantaa, etc.)
export const municipalities = pgTable("municipalities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(), // e.g., 'Helsinki', 'Espoo', 'Vantaa'
  code: text("code").notNull().unique(), // e.g., 'HEL', 'ESP', 'VAN'
  defaultMenuSourceType: text("default_menu_source_type").notNull().default('none'), // 'aromi', 'manual', 'none'
  defaultMenuSourceUrl: text("default_menu_source_url"), // Default menu URL for municipality
  contactEmail: text("contact_email"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const daycares = pgTable("daycares", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  municipalityId: integer("municipality_id").references(() => municipalities.id),
  municipality: text("municipality"), // Legacy field for backwards compatibility
  menuSourceType: text("menu_source_type").notNull().default('none'), // 'aromi', 'manual', 'none' - overrides municipality default
  menuSourceUrl: text("menu_source_url"), // For aromi: the specific school/daycare URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Groups within a daycare (e.g., "Toddlers", "Preschool")
export const daycareGroups = pgTable("daycare_groups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  daycareId: integer("daycare_id").references(() => daycares.id),
  // User lifecycle fields for GDPR compliance
  passwordNeedsReset: boolean("password_needs_reset").notNull().default(true),
  passwordChangedAt: timestamp("password_changed_at"),
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  lastLoginAt: timestamp("last_login_at"),
  // Account lockout for VAHTI compliance
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Session tokens for secure logout (invalidates JWT on logout)
export const sessionTokens = pgTable("session_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Teacher to group assignments (a teacher can belong to multiple groups)
export const teacherGroupAssignments = pgTable("teacher_group_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  groupId: integer("group_id").notNull().references(() => daycareGroups.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit logs for GDPR compliance - NO personal data stored
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  actorId: integer("actor_id"), // null if system action
  actorRole: text("actor_role").notNull(),
  daycareId: integer("daycare_id"), // null for super_admin actions
  action: text("action").notNull(), // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'VIEW'
  entityType: text("entity_type").notNull(), // e.g., 'user', 'child', 'trip'
  entityIdHash: text("entity_id_hash"), // hashed ID for audit without exposing personal data
  metadata: jsonb("metadata"), // additional non-PII context
});

export const children = pgTable("children", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  birthdate: date("birthdate").notNull(),
  groupId: integer("group_id"),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
});

export const guardians = pgTable("guardians", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  childId: integer("child_id").notNull().references(() => children.id),
});

export const entries = pgTable("entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  childId: integer("child_id").notNull().references(() => children.id),
  type: text("type").notNull(),
  value: text("value").notNull(),
  note: text("note"),
  staffId: integer("staff_id").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const trips = pgTable("trips", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  location: text("location").notNull(),
  cost: integer("cost").notNull().default(0),
  createdBy: integer("created_by").notNull().references(() => users.id),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  groupId: integer("group_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tripResponses = pgTable("trip_responses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  guardianId: integer("guardian_id").notNull().references(() => users.id),
  childId: integer("child_id").notNull().references(() => children.id),
  response: text("response").notNull(),
  respondedAt: timestamp("responded_at").notNull().defaultNow(),
});

export const absences = pgTable("absences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  childId: integer("child_id").notNull().references(() => children.id),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  type: text("type").notNull(),
  date: date("date").notNull(),
  reason: text("reason"),
  reportedById: integer("reported_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id").notNull().references(() => users.id),
  childId: integer("child_id").references(() => children.id),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(),
  fileUrl: text("file_url"),
  publishedById: integer("published_by_id").notNull().references(() => users.id),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Meal menu items scraped from external sources (e.g., Aromi) - now per daycare
export const mealMenus = pgTable("meal_menus", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  daycareId: integer("daycare_id").references(() => daycares.id), // null = global/shared menu
  date: date("date").notNull(),
  mealType: text("meal_type").notNull(), // 'breakfast', 'lunch', 'vegetarian_lunch', 'snack'
  foodName: text("food_name").notNull(),
  foodDescription: text("food_description"),
  dietInfo: text("diet_info"), // comma-separated: L,M,G,N,S,K,Veg
  sourceUrl: text("source_url"), // for extensibility - which municipality source
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
});

// Dynamic forms system - Admin creates forms, Guardians fill them out
export const forms = pgTable("forms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'consent', 'survey', 'registration', 'general'
  fields: jsonb("fields").notNull(), // JSON array of field definitions
  isActive: boolean("is_active").notNull().default(true),
  requiresChildContext: boolean("requires_child_context").notNull().default(true), // If true, submission tied to specific child
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Form submissions from guardians
export const formSubmissions = pgTable("form_submissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  formId: integer("form_id").notNull().references(() => forms.id),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  submittedById: integer("submitted_by_id").notNull().references(() => users.id),
  childId: integer("child_id").references(() => children.id), // null if form doesn't require child context
  responses: jsonb("responses").notNull(), // JSON object matching form fields
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

// Child-specific consents (quick consents that staff can view at a glance)
export const childConsents = pgTable("child_consents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  childId: integer("child_id").notNull().references(() => children.id),
  daycareId: integer("daycare_id").notNull().references(() => daycares.id),
  consentType: text("consent_type").notNull(), // 'image_internal', 'image_external', 'trips', 'medical_treatment'
  granted: boolean("granted").notNull().default(false),
  grantedById: integer("granted_by_id").notNull().references(() => users.id),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const municipalitiesRelations = relations(municipalities, ({ many }) => ({
  daycares: many(daycares),
}));

export const daycaresRelations = relations(daycares, ({ one, many }) => ({
  municipalityRef: one(municipalities, {
    fields: [daycares.municipalityId],
    references: [municipalities.id],
  }),
  users: many(users),
  children: many(children),
  groups: many(daycareGroups),
  forms: many(forms),
  mealMenus: many(mealMenus),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  daycare: one(daycares, {
    fields: [forms.daycareId],
    references: [daycares.id],
  }),
  creator: one(users, {
    fields: [forms.createdById],
    references: [users.id],
  }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, {
    fields: [formSubmissions.formId],
    references: [forms.id],
  }),
  daycare: one(daycares, {
    fields: [formSubmissions.daycareId],
    references: [daycares.id],
  }),
  submitter: one(users, {
    fields: [formSubmissions.submittedById],
    references: [users.id],
  }),
  child: one(children, {
    fields: [formSubmissions.childId],
    references: [children.id],
  }),
}));

export const childConsentsRelations = relations(childConsents, ({ one }) => ({
  child: one(children, {
    fields: [childConsents.childId],
    references: [children.id],
  }),
  daycare: one(daycares, {
    fields: [childConsents.daycareId],
    references: [daycares.id],
  }),
  grantedBy: one(users, {
    fields: [childConsents.grantedById],
    references: [users.id],
  }),
}));

export const mealMenusRelations = relations(mealMenus, ({ one }) => ({
  daycare: one(daycares, {
    fields: [mealMenus.daycareId],
    references: [daycares.id],
  }),
}));

export const daycareGroupsRelations = relations(daycareGroups, ({ one, many }) => ({
  daycare: one(daycares, {
    fields: [daycareGroups.daycareId],
    references: [daycares.id],
  }),
  children: many(children),
  teacherAssignments: many(teacherGroupAssignments),
}));

export const teacherGroupAssignmentsRelations = relations(teacherGroupAssignments, ({ one }) => ({
  user: one(users, {
    fields: [teacherGroupAssignments.userId],
    references: [users.id],
  }),
  group: one(daycareGroups, {
    fields: [teacherGroupAssignments.groupId],
    references: [daycareGroups.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  daycare: one(daycares, {
    fields: [users.daycareId],
    references: [daycares.id],
  }),
  guardianRelations: many(guardians),
  entries: many(entries),
  tripsCreated: many(trips),
  tripResponses: many(tripResponses),
  sessionTokens: many(sessionTokens),
}));

export const sessionTokensRelations = relations(sessionTokens, ({ one }) => ({
  user: one(users, {
    fields: [sessionTokens.userId],
    references: [users.id],
  }),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  daycare: one(daycares, {
    fields: [children.daycareId],
    references: [daycares.id],
  }),
  guardianRelations: many(guardians),
  entries: many(entries),
  tripResponses: many(tripResponses),
}));

export const guardiansRelations = relations(guardians, ({ one }) => ({
  user: one(users, {
    fields: [guardians.userId],
    references: [users.id],
  }),
  child: one(children, {
    fields: [guardians.childId],
    references: [children.id],
  }),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  child: one(children, {
    fields: [entries.childId],
    references: [children.id],
  }),
  staff: one(users, {
    fields: [entries.staffId],
    references: [users.id],
  }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  creator: one(users, {
    fields: [trips.createdBy],
    references: [users.id],
  }),
  daycare: one(daycares, {
    fields: [trips.daycareId],
    references: [daycares.id],
  }),
  responses: many(tripResponses),
}));

export const tripResponsesRelations = relations(tripResponses, ({ one }) => ({
  trip: one(trips, {
    fields: [tripResponses.tripId],
    references: [trips.id],
  }),
  guardian: one(users, {
    fields: [tripResponses.guardianId],
    references: [users.id],
  }),
  child: one(children, {
    fields: [tripResponses.childId],
    references: [children.id],
  }),
}));

export const absencesRelations = relations(absences, ({ one }) => ({
  child: one(children, {
    fields: [absences.childId],
    references: [children.id],
  }),
  daycare: one(daycares, {
    fields: [absences.daycareId],
    references: [daycares.id],
  }),
  reporter: one(users, {
    fields: [absences.reportedById],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  daycare: one(daycares, {
    fields: [messages.daycareId],
    references: [daycares.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [messages.recipientId],
    references: [users.id],
  }),
  child: one(children, {
    fields: [messages.childId],
    references: [children.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  daycare: one(daycares, {
    fields: [documents.daycareId],
    references: [daycares.id],
  }),
  publisher: one(users, {
    fields: [documents.publishedById],
    references: [users.id],
  }),
}));

export const insertMunicipalitySchema = z.object({
  name: z.string().min(1).transform(s => s.trim()),
  code: z.string().min(1).max(10).transform(s => s.trim().toUpperCase()),
  defaultMenuSourceType: z.enum(['none', 'aromi', 'manual']).optional().default('none'),
  defaultMenuSourceUrl: z.string().optional().transform(s => s?.trim() || undefined),
  contactEmail: z.string().email().optional().transform(s => s?.trim().toLowerCase() || undefined),
  isActive: z.boolean().optional().default(true),
});

export const updateMunicipalitySchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).optional(),
  code: z.string().min(1).max(10).transform(s => s.trim().toUpperCase()).optional(),
  defaultMenuSourceType: z.enum(['none', 'aromi', 'manual']).optional(),
  defaultMenuSourceUrl: z.union([
    z.string().min(1).transform(s => s.trim()),
    z.literal('').transform(() => null),
    z.null()
  ]).optional(),
  contactEmail: z.union([
    z.string().email().transform(s => s.trim().toLowerCase()),
    z.literal('').transform(() => null),
    z.null()
  ]).optional(),
  isActive: z.boolean().optional(),
}).strict().refine(
  data => {
    const hasValue = Object.entries(data).some(([_, v]) => v !== undefined);
    return hasValue;
  },
  { message: 'At least one valid field must be provided' }
);

export const insertDaycareSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  municipalityId: z.number().int().positive().optional(),
  municipality: z.string().optional(),
  menuSourceType: z.enum(['none', 'aromi', 'manual']).optional().default('none'),
  menuSourceUrl: z.string().optional(),
});

export const insertUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  role: z.string().min(1),
  daycareId: z.number().int().positive().nullable().optional(),
  passwordNeedsReset: z.boolean().optional(),
});

// Strong password policy: 8+ chars, uppercase, lowercase, number, special character
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const strongPasswordMessage = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().regex(strongPasswordRegex, strongPasswordMessage),
  role: z.enum(['daycareleader', 'staff', 'guardian']),
  daycareId: z.number().int().positive().nullable().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  daycareCode: z.string().min(1),
});

export const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const insertChildSchema = z.object({
  name: z.string().min(1),
  birthdate: z.string(),
  groupId: z.number().int().positive().nullable().optional(),
  daycareId: z.number().int().positive(),
});

export const insertEntrySchema = z.object({
  childId: z.number().int().positive(),
  type: z.string().min(1),
  value: z.string().min(1),
  note: z.string().optional(),
  staffId: z.number().int().positive(),
});

export const insertTripSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string(),
  location: z.string().min(1),
  cost: z.number().int().nonnegative().optional(),
  createdBy: z.number().int().positive(),
  daycareId: z.number().int().positive(),
  groupId: z.number().int().positive().nullable().optional(),
});

export const insertTripResponseSchema = z.object({
  tripId: z.number().int().positive(),
  guardianId: z.number().int().positive(),
  childId: z.number().int().positive(),
  response: z.string().min(1),
});

export const insertAbsenceSchema = z.object({
  childId: z.number().int().positive(),
  daycareId: z.number().int().positive(),
  type: z.enum(['absence', 'sickness', 'late_arrival', 'early_pickup']),
  date: z.string(),
  reason: z.string().optional(),
  reportedById: z.number().int().positive(),
});

export const insertMessageSchema = z.object({
  daycareId: z.number().int().positive(),
  senderId: z.number().int().positive(),
  recipientId: z.number().int().positive(),
  childId: z.number().int().positive().optional(),
  content: z.string().min(1),
  imageUrl: z.string().optional(),
});

export const insertDocumentSchema = z.object({
  daycareId: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(['announcement', 'menu', 'form', 'general']),
  fileUrl: z.string().optional(),
  publishedById: z.number().int().positive(),
});

export const insertNotificationSchema = z.object({
  userId: z.number().int().positive(),
  daycareId: z.number().int().positive(),
  type: z.enum(['entry', 'trip', 'message', 'absence', 'document']),
  title: z.string().min(1),
  message: z.string().min(1),
  relatedId: z.number().int().positive().optional(),
});

export const insertMealMenuSchema = z.object({
  daycareId: z.number().int().positive().nullable().optional(),
  date: z.string(),
  mealType: z.enum(['breakfast', 'lunch', 'vegetarian_lunch', 'snack']),
  foodName: z.string().min(1),
  foodDescription: z.string().optional(),
  dietInfo: z.string().optional(),
  sourceUrl: z.string().optional(),
});

// Form field definition schema (used inside forms.fields)
export const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'textarea', 'checkbox', 'select', 'radio', 'date', 'number']),
  label: z.string().min(1),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // For select and radio fields
  placeholder: z.string().optional(),
  readonly: z.boolean().optional(), // Field is display-only (e.g., trip name set by staff)
  value: z.string().optional(), // Default/preset value for readonly fields
});

export const insertFormSchema = z.object({
  daycareId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['consent', 'survey', 'registration', 'general']),
  fields: z.array(formFieldSchema),
  isActive: z.boolean().default(true),
  requiresChildContext: z.boolean().default(true),
  createdById: z.number().int().positive(),
});

export const insertFormSubmissionSchema = z.object({
  formId: z.number().int().positive(),
  daycareId: z.number().int().positive(),
  submittedById: z.number().int().positive(),
  childId: z.number().int().positive().nullable().optional(),
  responses: z.record(z.any()), // Dynamic based on form fields
});

export const insertChildConsentSchema = z.object({
  childId: z.number().int().positive(),
  daycareId: z.number().int().positive(),
  consentType: z.enum(['image_internal', 'image_external', 'trips', 'medical_treatment']),
  granted: z.boolean(),
  grantedById: z.number().int().positive(),
  notes: z.string().optional(),
});

// New schemas for GDPR compliance
export const insertDaycareGroupSchema = z.object({
  daycareId: z.number().int().positive(),
  name: z.string().min(1),
});

export const insertTeacherGroupAssignmentSchema = z.object({
  userId: z.number().int().positive(),
  groupId: z.number().int().positive(),
});

export const insertAuditLogSchema = z.object({
  actorId: z.number().int().positive().nullable().optional(),
  actorRole: z.string().min(1),
  daycareId: z.number().int().positive().nullable().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'ACCESS_DENIED']),
  entityType: z.string().min(1),
  entityIdHash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().regex(strongPasswordRegex, strongPasswordMessage),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const insertSessionTokenSchema = z.object({
  userId: z.number().int().positive(),
  tokenHash: z.string().min(1),
  expiresAt: z.date(),
});

// GDPR Data Deletion Requests
export const deleteRequests = pgTable("delete_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  daycareId: integer("daycare_id").references(() => daycares.id),
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'denied'
  reason: text("reason"), // Optional reason from user
  adminNote: text("admin_note"), // Optional note from admin
  processedById: integer("processed_by_id").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deleteRequestsRelations = relations(deleteRequests, ({ one }) => ({
  user: one(users, {
    fields: [deleteRequests.userId],
    references: [users.id],
  }),
  daycare: one(daycares, {
    fields: [deleteRequests.daycareId],
    references: [daycares.id],
  }),
  processedBy: one(users, {
    fields: [deleteRequests.processedById],
    references: [users.id],
  }),
}));

export const insertDeleteRequestSchema = z.object({
  userId: z.number().int().positive(),
  daycareId: z.number().int().positive().nullable().optional(),
  reason: z.string().optional(),
});

// Push notification tokens for mobile apps
export const pushTokens = pgTable("push_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  platform: text("platform").notNull(), // 'ios' or 'android'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPushTokenSchema = z.object({
  userId: z.number().int().positive(),
  token: z.string().min(1),
  platform: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().regex(strongPasswordRegex, strongPasswordMessage),
});

export type Municipality = typeof municipalities.$inferSelect;
export type InsertMunicipality = z.infer<typeof insertMunicipalitySchema>;
export type UpdateMunicipality = z.infer<typeof updateMunicipalitySchema>;
export type Daycare = typeof daycares.$inferSelect;
export type InsertDaycare = z.infer<typeof insertDaycareSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type SuperAdminLoginRequest = z.infer<typeof superAdminLoginSchema>;
export type Child = typeof children.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Entry = typeof entries.$inferSelect;
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripResponse = typeof tripResponses.$inferSelect;
export type InsertTripResponse = z.infer<typeof insertTripResponseSchema>;
export type Absence = typeof absences.$inferSelect;
export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// New types for GDPR compliance
export type DaycareGroup = typeof daycareGroups.$inferSelect;
export type InsertDaycareGroup = z.infer<typeof insertDaycareGroupSchema>;
export type TeacherGroupAssignment = typeof teacherGroupAssignments.$inferSelect;
export type InsertTeacherGroupAssignment = z.infer<typeof insertTeacherGroupAssignmentSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type SessionToken = typeof sessionTokens.$inferSelect;
export type InsertSessionToken = z.infer<typeof insertSessionTokenSchema>;

// Meal menu types
export type MealMenu = typeof mealMenus.$inferSelect;
export type InsertMealMenu = z.infer<typeof insertMealMenuSchema>;

// Forms system types
export type Form = typeof forms.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type ChildConsent = typeof childConsents.$inferSelect;
export type InsertChildConsent = z.infer<typeof insertChildConsentSchema>;

// Push tokens types
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

// GDPR Delete Request types
export type DeleteRequest = typeof deleteRequests.$inferSelect;
export type InsertDeleteRequest = z.infer<typeof insertDeleteRequestSchema>;
