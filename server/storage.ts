import { 
  municipalities,
  daycares,
  users, 
  children, 
  guardians, 
  entries, 
  trips, 
  tripResponses,
  absences,
  messages,
  documents,
  notifications,
  daycareGroups,
  teacherGroupAssignments,
  auditLogs,
  mealMenus,
  forms,
  formSubmissions,
  childConsents,
  pushTokens,
  deleteRequests,
  sessionTokens,
  type Municipality,
  type InsertMunicipality,
  type Daycare,
  type InsertDaycare,
  type User, 
  type InsertUser,
  type Child,
  type InsertChild,
  type Entry,
  type InsertEntry,
  type Trip,
  type InsertTrip,
  type TripResponse,
  type InsertTripResponse,
  type Absence,
  type InsertAbsence,
  type Message,
  type InsertMessage,
  type Document,
  type InsertDocument,
  type Notification,
  type InsertNotification,
  type DaycareGroup,
  type InsertDaycareGroup,
  type TeacherGroupAssignment,
  type InsertTeacherGroupAssignment,
  type AuditLog,
  type InsertAuditLog,
  type MealMenu,
  type InsertMealMenu,
  type Form,
  type InsertForm,
  type FormSubmission,
  type InsertFormSubmission,
  type ChildConsent,
  type InsertChildConsent,
  type PushToken,
  type InsertPushToken,
  type DeleteRequest,
  type InsertDeleteRequest,
  type SessionToken,
  type InsertSessionToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, or, desc, asc, count, sql, isNull, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import crypto from "crypto";

import { LIST_LIMITS } from "./pagination";
export { LIST_LIMITS, MAX_LIST_LIMIT } from "./pagination";

export interface IStorage {
  // Municipality CRUD
  getMunicipality(id: number): Promise<Municipality | undefined>;
  getMunicipalityByCode(code: string): Promise<Municipality | undefined>;
  getAllMunicipalities(): Promise<Municipality[]>;
  createMunicipality(municipality: InsertMunicipality): Promise<Municipality>;
  updateMunicipality(id: number, updates: Partial<InsertMunicipality>): Promise<Municipality | undefined>;
  deleteMunicipality(id: number): Promise<void>;
  
  // Daycare CRUD
  getDaycare(id: number): Promise<Daycare | undefined>;
  getDaycareByCode(code: string): Promise<Daycare | undefined>;
  createDaycare(daycare: InsertDaycare): Promise<Daycare>;
  updateDaycare(id: number, updates: Partial<InsertDaycare>): Promise<Daycare | undefined>;
  getAllDaycares(): Promise<Daycare[]>;
  deleteDaycare(id: number): Promise<void>;
  getUniqueMunicipalities(): Promise<string[]>;
  getDaycaresByMunicipality(municipality: string): Promise<Daycare[]>;
  getDaycaresByMunicipalityId(municipalityId: number): Promise<Daycare[]>;
  
  getUser(id: number): Promise<User | undefined>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByDaycare(daycareId: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  getChildren(daycareId: number, limit?: number, offset?: number): Promise<Child[]>;
  getAllChildren(): Promise<Child[]>;
  getChildrenByGuardian(guardianId: number): Promise<Child[]>;
  getChild(id: number): Promise<Child | undefined>;
  createChild(child: InsertChild): Promise<Child>;
  deleteChild(id: number): Promise<void>;
  deleteGuardianRelation(userId: number, childId: number): Promise<void>;
  deleteGuardiansByUserId(userId: number): Promise<void>;
  deleteGuardiansByChildId(childId: number): Promise<void>;
  
  getEntries(daycareId: number, limit?: number, offset?: number): Promise<Entry[]>;
  getAllEntries(): Promise<Entry[]>;
  getEntriesByChild(childId: number, limit?: number, offset?: number): Promise<Entry[]>;
  getEntriesByDateRange(daycareId: number, startDate: Date, endDate: Date): Promise<Entry[]>;
  createEntry(entry: InsertEntry): Promise<Entry>;
  
  getTrips(daycareId: number, limit?: number, offset?: number): Promise<Trip[]>;
  getAllTrips(): Promise<Trip[]>;
  getTrip(id: number): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;
  
  getTripResponses(daycareId: number): Promise<TripResponse[]>;
  getAllTripResponses(): Promise<TripResponse[]>;
  getTripResponsesByGuardian(guardianId: number): Promise<TripResponse[]>;
  createTripResponse(response: InsertTripResponse): Promise<TripResponse>;
  
  createGuardianRelation(userId: number, childId: number): Promise<void>;
  
  getAbsences(daycareId: number, limit?: number, offset?: number): Promise<Absence[]>;
  getAllAbsences(): Promise<Absence[]>;
  getAbsencesByChild(childId: number): Promise<Absence[]>;
  getAbsencesByDateRange(daycareId: number, startDate: Date, endDate: Date): Promise<Absence[]>;
  createAbsence(absence: InsertAbsence): Promise<Absence>;
  
  getMessages(userId: number, daycareId: number, limit?: number, offset?: number): Promise<Message[]>;
  getMessageById(id: number): Promise<Message | undefined>;
  getConversation(userId: number, otherUserId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(messageId: number): Promise<void>;
  getUnreadCount(userId: number): Promise<number>;
  
  getDocuments(daycareId: number): Promise<Document[]>;
  getDocumentsByType(daycareId: number, type: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  
  getNotifications(userId: number, limit?: number, offset?: number): Promise<Notification[]>;
  getNotificationById(id: number): Promise<Notification | undefined>;
  createNotifications(list: InsertNotification[]): Promise<number>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(notificationId: number): Promise<void>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  getGuardiansForChild(childId: number): Promise<User[]>;
  getGuardiansForChildren(childIds: number[]): Promise<User[]>;
  getChildrenByGuardians(userIds: number[]): Promise<Map<number, Child[]>>;
  getStaffByDaycare(daycareId: number): Promise<User[]>;
  
  // Daycare Groups
  getDaycareGroups(daycareId: number): Promise<DaycareGroup[]>;
  getDaycareGroup(id: number): Promise<DaycareGroup | undefined>;
  getGroupById(id: number): Promise<DaycareGroup | undefined>;
  createDaycareGroup(group: InsertDaycareGroup): Promise<DaycareGroup>;
  deleteDaycareGroup(id: number): Promise<void>;
  
  // Teacher Group Assignments
  getTeacherGroups(userId: number): Promise<DaycareGroup[]>;
  getGroupTeachers(groupId: number): Promise<User[]>;
  assignTeacherToGroup(assignment: InsertTeacherGroupAssignment): Promise<TeacherGroupAssignment>;
  removeTeacherFromGroup(userId: number, groupId: number): Promise<void>;
  
  // Children by Group (for teacher scoping)
  getChildrenByGroup(groupId: number): Promise<Child[]>;
  getChildrenByTeacherGroups(userId: number): Promise<Child[]>;
  
  // Audit Logging (GDPR compliant - no personal data)
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(daycareId?: number, limit?: number, offset?: number): Promise<AuditLog[]>;
  
  // User Lifecycle
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;
  setPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  getUserByResetToken(tokenHash: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: number): Promise<void>;
  updateLastLogin(userId: number): Promise<void>;
  
  // Super Admin specific (GDPR compliant)
  getDaycareLeadersByDaycare(daycareId: number): Promise<User[]>;
  getAnonymizedStats(): Promise<{
    totalDaycares: number;
    totalChildren: number;
    totalStaff: number;
    totalGuardians: number;
    totalTrips: number;
    totalAbsencesToday: number;
    daycareStats: {
      daycareId: number;
      daycareName: string;
      childrenCount: number;
      staffCount: number;
      guardianCount: number;
    }[];
  }>;
  
  // Daycare Admin KPI stats
  getDaycareStats(daycareId: number): Promise<{
    childrenCount: number;
    staffCount: number;
    guardianCount: number;
    absencesToday: number;
    attendanceRate: number;
    entriesToday: number;
    entryBreakdown: {
      sleep: number;
      meal: number;
      play: number;
      incident: number;
    };
    activeTrips: number;
    pendingForms: number;
  }>;
  
  // Meal Menu (scraped from external sources)
  getMealMenuByDate(date: string, daycareId?: number): Promise<MealMenu[]>;
  getMealMenuByDateRange(startDate: string, endDate: string, daycareId?: number): Promise<MealMenu[]>;
  getLatestMealMenu(daycareId?: number): Promise<MealMenu[]>;
  createMealMenu(menu: InsertMealMenu): Promise<MealMenu>;
  deleteMealMenuByDate(date: string, daycareId?: number): Promise<void>;
  
  // Daycare settings update
  updateDaycareMenuSettings(daycareId: number, settings: { municipality?: string; menuSourceType?: string; menuSourceUrl?: string }): Promise<Daycare>;
  getDaycaresByMenuSource(menuSourceType: string): Promise<Daycare[]>;
  
  // Forms system
  getForms(daycareId: number): Promise<Form[]>;
  getForm(id: number): Promise<Form | undefined>;
  getActiveForms(daycareId: number): Promise<Form[]>;
  createForm(form: InsertForm): Promise<Form>;
  updateForm(id: number, updates: Partial<InsertForm>): Promise<Form>;
  deleteForm(id: number): Promise<void>;
  
  // Form Submissions
  getFormSubmissions(formId: number): Promise<FormSubmission[]>;
  getFormSubmissionsByChild(childId: number): Promise<FormSubmission[]>;
  getFormSubmissionsByUser(userId: number): Promise<FormSubmission[]>;
  getFormSubmission(id: number): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  checkFormSubmissionExists(formId: number, childId?: number, userId?: number): Promise<boolean>;
  
  // Child Consents
  getChildConsents(childId: number): Promise<ChildConsent[]>;
  getChildConsentsByDaycare(daycareId: number): Promise<ChildConsent[]>;
  getChildConsent(childId: number, consentType: string): Promise<ChildConsent | undefined>;
  createOrUpdateChildConsent(consent: InsertChildConsent): Promise<ChildConsent>;
  deleteChildConsent(id: number): Promise<void>;
  
  // Push Tokens
  savePushToken(userId: number, token: string, platform: string): Promise<PushToken>;
  getPushTokensByUser(userId: number): Promise<PushToken[]>;
  getPushTokensByUsers(userIds: number[]): Promise<PushToken[]>;
  deletePushToken(userId: number, token: string): Promise<void>;
  
  // Health Check
  checkDatabaseConnection(): Promise<boolean>;
  
  // GDPR Delete Requests
  createDeleteRequest(request: InsertDeleteRequest): Promise<DeleteRequest>;
  getDeleteRequests(daycareId?: number): Promise<DeleteRequest[]>;
  getDeleteRequestsByUser(userId: number): Promise<DeleteRequest[]>;
  getDeleteRequest(id: number): Promise<DeleteRequest | undefined>;
  updateDeleteRequestStatus(id: number, status: string, processedById: number, adminNote?: string): Promise<DeleteRequest>;
  
  // GDPR Data Export - returns all data for a guardian user
  getGuardianDataExport(userId: number): Promise<{
    user: Omit<User, 'passwordHash' | 'resetTokenHash'>;
    children: Child[];
    entries: Entry[];
    tripResponses: TripResponse[];
    messages: Message[];
    absences: Absence[];
    formSubmissions: FormSubmission[];
  }>;
  
  // Session Token Management (VAHTI compliance - secure logout)
  createSessionToken(userId: number, tokenHash: string, expiresAt: Date): Promise<SessionToken>;
  getSessionToken(tokenHash: string): Promise<SessionToken | undefined>;
  getUserBySessionToken(tokenHash: string): Promise<{ user: User; sessionToken: SessionToken } | undefined>;
  deleteSessionToken(tokenHash: string): Promise<void>;
  deleteUserSessionTokens(userId: number): Promise<void>;
  deleteExpiredSessionTokens(): Promise<number>;
  
  // Account Lockout (VAHTI compliance - brute force protection)
  incrementFailedLoginAttempts(userId: number): Promise<number>;
  resetFailedLoginAttempts(userId: number): Promise<void>;
  lockUserAccount(userId: number, lockUntil: Date): Promise<void>;
  unlockUserAccount(userId: number): Promise<void>;
  isUserLocked(userId: number): Promise<boolean>;
  
  // GDPR Data Retention (automated cleanup)
  cleanupOldAuditLogs(retentionMonths: number): Promise<number>;
  cleanupOldMessages(retentionMonths: number): Promise<number>;
  cleanupOldTrips(retentionMonths: number): Promise<number>;
  cleanupOldAbsences(retentionMonths: number): Promise<number>;
  cleanupOldNotifications(retentionMonths: number): Promise<number>;
  cleanupOldEntries(retentionMonths: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Municipality CRUD
  async getMunicipality(id: number): Promise<Municipality | undefined> {
    const [municipality] = await db.select().from(municipalities).where(eq(municipalities.id, id));
    return municipality || undefined;
  }

  async getMunicipalityByCode(code: string): Promise<Municipality | undefined> {
    const [municipality] = await db.select().from(municipalities).where(eq(municipalities.code, code));
    return municipality || undefined;
  }

  async getAllMunicipalities(): Promise<Municipality[]> {
    return await db.select().from(municipalities).orderBy(asc(municipalities.name));
  }

  async createMunicipality(insertMunicipality: InsertMunicipality): Promise<Municipality> {
    const [municipality] = await db
      .insert(municipalities)
      .values(insertMunicipality)
      .returning();
    return municipality;
  }

  async updateMunicipality(id: number, updates: Partial<InsertMunicipality>): Promise<Municipality | undefined> {
    const [updated] = await db
      .update(municipalities)
      .set(updates)
      .where(eq(municipalities.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMunicipality(id: number): Promise<void> {
    // First unlink all daycares from this municipality
    await db.update(daycares)
      .set({ municipalityId: null })
      .where(eq(daycares.municipalityId, id));
    // Then delete the municipality
    await db.delete(municipalities).where(eq(municipalities.id, id));
  }

  // Daycare CRUD
  async getDaycare(id: number): Promise<Daycare | undefined> {
    const [daycare] = await db.select().from(daycares).where(eq(daycares.id, id));
    return daycare || undefined;
  }

  async getDaycareByCode(code: string): Promise<Daycare | undefined> {
    const [daycare] = await db.select().from(daycares).where(eq(daycares.code, code));
    return daycare || undefined;
  }

  async createDaycare(insertDaycare: InsertDaycare): Promise<Daycare> {
    const [daycare] = await db
      .insert(daycares)
      .values(insertDaycare)
      .returning();
    return daycare;
  }

  async updateDaycare(id: number, updates: Partial<InsertDaycare>): Promise<Daycare | undefined> {
    const [updated] = await db
      .update(daycares)
      .set(updates)
      .where(eq(daycares.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllDaycares(): Promise<Daycare[]> {
    return await db.select().from(daycares);
  }

  async getUniqueMunicipalities(): Promise<string[]> {
    const result = await db
      .selectDistinct({ municipality: daycares.municipality })
      .from(daycares)
      .where(sql`${daycares.municipality} IS NOT NULL AND ${daycares.municipality} != ''`);
    return result.map(r => r.municipality!).filter(Boolean);
  }

  async getDaycaresByMunicipality(municipality: string): Promise<Daycare[]> {
    return await db
      .select()
      .from(daycares)
      .where(eq(daycares.municipality, municipality));
  }

  async getDaycaresByMunicipalityId(municipalityId: number): Promise<Daycare[]> {
    return await db
      .select()
      .from(daycares)
      .where(eq(daycares.municipalityId, municipalityId));
  }

  async deleteDaycare(id: number): Promise<void> {
    // Set-based rather than a delete per user and per child: a daycare with 100
    // children and 70 staff previously issued well over a thousand statements. It
    // also ran outside a transaction, so a failure part-way left the daycare in a
    // half-deleted state.
    //
    // The previous version additionally never removed meal_menus, forms,
    // form_submissions, child_consents, delete_requests, push_tokens,
    // teacher_group_assignments, daycare_groups or trip_responses, all of which
    // carry foreign keys into this daycare -- so deleting a daycare that had ever
    // had a menu or a form failed on a constraint violation. Every referencing
    // table is now covered, in dependency order.
    await db.transaction(async (tx) => {
      const [daycareUsers, daycareChildren, daycareGroupRows, daycareTrips] = await Promise.all([
        tx.select({ id: users.id }).from(users).where(eq(users.daycareId, id)),
        tx.select({ id: children.id }).from(children).where(eq(children.daycareId, id)),
        tx.select({ id: daycareGroups.id }).from(daycareGroups).where(eq(daycareGroups.daycareId, id)),
        tx.select({ id: trips.id }).from(trips).where(eq(trips.daycareId, id)),
      ]);

      const userIds = daycareUsers.map((u) => u.id);
      const childIds = daycareChildren.map((c) => c.id);
      const groupIds = daycareGroupRows.map((g) => g.id);
      const tripIds = daycareTrips.map((t) => t.id);

      // inArray() with an empty list is not valid SQL, so each term is only included
      // when it has values.
      const byUser = (col: AnyPgColumn) => (userIds.length ? inArray(col, userIds) : undefined);
      const byChild = (col: AnyPgColumn) => (childIds.length ? inArray(col, childIds) : undefined);

      // Every delete below goes through this. or() returns undefined when all of its
      // terms are undefined, and Drizzle treats .where(undefined) as no WHERE clause
      // at all -- which would delete every row in the table. When there is nothing to
      // match, there is nothing to delete.
      const deleteWhere = async (table: PgTable, ...conditions: (SQL | undefined)[]) => {
        const defined = conditions.filter((c): c is SQL => c !== undefined);
        if (defined.length === 0) return;
        await tx.delete(table).where(defined.length === 1 ? defined[0] : or(...defined));
      };

      // Rows that reference users or children, including any that live in another
      // daycare but point at ours.
      await deleteWhere(teacherGroupAssignments,
        byUser(teacherGroupAssignments.userId),
        groupIds.length ? inArray(teacherGroupAssignments.groupId, groupIds) : undefined);
      await deleteWhere(sessionTokens, byUser(sessionTokens.userId));
      await deleteWhere(pushTokens, byUser(pushTokens.userId));
      await deleteWhere(deleteRequests,
        eq(deleteRequests.daycareId, id),
        byUser(deleteRequests.userId),
        byUser(deleteRequests.processedById));
      await deleteWhere(tripResponses,
        tripIds.length ? inArray(tripResponses.tripId, tripIds) : undefined,
        byUser(tripResponses.guardianId),
        byChild(tripResponses.childId));
      await deleteWhere(formSubmissions,
        eq(formSubmissions.daycareId, id),
        byUser(formSubmissions.submittedById),
        byChild(formSubmissions.childId));
      await deleteWhere(childConsents,
        eq(childConsents.daycareId, id),
        byChild(childConsents.childId),
        byUser(childConsents.grantedById));
      await deleteWhere(guardians, byUser(guardians.userId), byChild(guardians.childId));
      await deleteWhere(entries, byChild(entries.childId), byUser(entries.staffId));
      await deleteWhere(absences,
        eq(absences.daycareId, id),
        byChild(absences.childId),
        byUser(absences.reportedById));
      await deleteWhere(messages,
        eq(messages.daycareId, id),
        byUser(messages.senderId),
        byUser(messages.recipientId),
        byChild(messages.childId));
      await deleteWhere(notifications,
        eq(notifications.daycareId, id),
        byUser(notifications.userId));
      await deleteWhere(documents,
        eq(documents.daycareId, id),
        byUser(documents.publishedById));

      // Now the rows those depended on.
      await deleteWhere(forms, eq(forms.daycareId, id), byUser(forms.createdById));
      await deleteWhere(mealMenus, eq(mealMenus.daycareId, id));
      await deleteWhere(trips, eq(trips.daycareId, id), byUser(trips.createdBy));
      await deleteWhere(children, eq(children.daycareId, id));
      await deleteWhere(daycareGroups, eq(daycareGroups.daycareId, id));
      await deleteWhere(users, eq(users.daycareId, id));

      await deleteWhere(daycares, eq(daycares.id, id));
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUsersByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, ids));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUsersByDaycare(daycareId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.daycareId, daycareId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    // Delete all foreign key references to this user
    // 1. Delete guardian relations
    await this.deleteGuardiansByUserId(id);
    
    // 2. Delete entries where user is staff
    await db.delete(entries).where(eq(entries.staffId, id));
    
    // 3. Delete trips created by this user
    await db.delete(trips).where(eq(trips.createdBy, id));
    
    // 4. Delete trip responses from this user
    await db.delete(tripResponses).where(eq(tripResponses.guardianId, id));
    
    // 5. Delete absences reported by this user
    await db.delete(absences).where(eq(absences.reportedById, id));
    
    // 6. Delete messages sent/received by this user
    await db.delete(messages).where(or(
      eq(messages.senderId, id),
      eq(messages.recipientId, id)
    ));
    
    // 7. Delete documents published by this user
    await db.delete(documents).where(eq(documents.publishedById, id));
    
    // 8. Delete notifications for this user
    await db.delete(notifications).where(eq(notifications.userId, id));
    
    // Finally delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async getChildren(daycareId: number, limit: number = LIST_LIMITS.children, offset: number = 0): Promise<Child[]> {
    return await db
      .select()
      .from(children)
      .where(eq(children.daycareId, daycareId))
      .orderBy(children.id)
      .limit(limit)
      .offset(offset);
  }

  async getAllChildren(): Promise<Child[]> {
    return await db.select().from(children);
  }

  async getChildrenByGuardian(guardianId: number): Promise<Child[]> {
    const guardianRelations = await db
      .select()
      .from(guardians)
      .where(eq(guardians.userId, guardianId));
    
    if (guardianRelations.length === 0) {
      return [];
    }
    
    const childIds = guardianRelations.map(g => g.childId);
    return await db
      .select()
      .from(children)
      .where(inArray(children.id, childIds));
  }

  async getChild(id: number): Promise<Child | undefined> {
    const [child] = await db.select().from(children).where(eq(children.id, id));
    return child || undefined;
  }

  async createChild(insertChild: InsertChild): Promise<Child> {
    const [child] = await db
      .insert(children)
      .values(insertChild)
      .returning();
    return child;
  }

  async deleteChild(id: number): Promise<void> {
    // Delete guardian relations first
    await this.deleteGuardiansByChildId(id);
    
    // Delete related entries
    await db.delete(entries).where(eq(entries.childId, id));
    
    // Delete related trip responses
    await db.delete(tripResponses).where(eq(tripResponses.childId, id));
    
    // Delete related absences
    await db.delete(absences).where(eq(absences.childId, id));
    
    // Delete the child
    await db.delete(children).where(eq(children.id, id));
  }

  async getEntries(daycareId: number, limit: number = LIST_LIMITS.entries, offset: number = 0): Promise<Entry[]> {
    // innerJoin, not leftJoin: the daycare filter lives on children, so a left join
    // could only ever produce rows this WHERE already discards. Selecting just the
    // entry columns also avoids carrying every child row back over the wire.
    return await db
      .select({ entry: entries })
      .from(entries)
      .innerJoin(children, eq(entries.childId, children.id))
      .where(eq(children.daycareId, daycareId))
      .orderBy(desc(entries.timestamp))
      .limit(limit)
      .offset(offset)
      .then(rows => rows.map(row => row.entry));
  }

  async getAllEntries(): Promise<Entry[]> {
    return await db.select().from(entries);
  }

  async getEntriesByChild(childId: number, limit: number = LIST_LIMITS.entries, offset: number = 0): Promise<Entry[]> {
    return await db
      .select()
      .from(entries)
      .where(eq(entries.childId, childId))
      .orderBy(desc(entries.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getEntriesByDateRange(daycareId: number, startDate: Date, endDate: Date): Promise<Entry[]> {
    return await db
      .select()
      .from(entries)
      .leftJoin(children, eq(entries.childId, children.id))
      .where(
        and(
          eq(children.daycareId, daycareId),
          gte(entries.timestamp, startDate),
          lte(entries.timestamp, endDate)
        )
      )
      .then(rows => rows.map(row => row.entries));
  }

  async createEntry(insertEntry: InsertEntry): Promise<Entry> {
    const [entry] = await db
      .insert(entries)
      .values(insertEntry)
      .returning();
    return entry;
  }

  async getTrips(daycareId: number, limit: number = LIST_LIMITS.trips, offset: number = 0): Promise<Trip[]> {
    return await db
      .select()
      .from(trips)
      .where(eq(trips.daycareId, daycareId))
      .orderBy(trips.date)
      .limit(limit)
      .offset(offset);
  }

  async getAllTrips(): Promise<Trip[]> {
    return await db.select().from(trips).orderBy(trips.date);
  }

  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const [trip] = await db
      .insert(trips)
      .values(insertTrip)
      .returning();
    return trip;
  }

  async deleteTrip(id: number): Promise<void> {
    await db.delete(trips).where(eq(trips.id, id));
  }

  async getTripResponses(daycareId: number): Promise<TripResponse[]> {
    return await db
      .select()
      .from(tripResponses)
      .leftJoin(users, eq(tripResponses.guardianId, users.id))
      .where(eq(users.daycareId, daycareId))
      .then(rows => rows.map(row => row.trip_responses));
  }

  async getAllTripResponses(): Promise<TripResponse[]> {
    return await db.select().from(tripResponses);
  }

  async getTripResponsesByGuardian(guardianId: number): Promise<TripResponse[]> {
    return await db
      .select()
      .from(tripResponses)
      .where(eq(tripResponses.guardianId, guardianId));
  }

  async createTripResponse(insertResponse: InsertTripResponse): Promise<TripResponse> {
    const [response] = await db
      .insert(tripResponses)
      .values(insertResponse)
      .returning();
    return response;
  }

  async createGuardianRelation(userId: number, childId: number): Promise<void> {
    await db.insert(guardians).values({ userId, childId });
  }

  async deleteGuardianRelation(userId: number, childId: number): Promise<void> {
    await db.delete(guardians).where(
      and(
        eq(guardians.userId, userId),
        eq(guardians.childId, childId)
      )
    );
  }

  async deleteGuardiansByUserId(userId: number): Promise<void> {
    await db.delete(guardians).where(eq(guardians.userId, userId));
  }

  async deleteGuardiansByChildId(childId: number): Promise<void> {
    await db.delete(guardians).where(eq(guardians.childId, childId));
  }

  async getAbsences(daycareId: number, limit: number = LIST_LIMITS.absences, offset: number = 0): Promise<Absence[]> {
    return await db
      .select()
      .from(absences)
      .where(eq(absences.daycareId, daycareId))
      .orderBy(desc(absences.date))
      .limit(limit)
      .offset(offset);
  }

  async getAllAbsences(): Promise<Absence[]> {
    return await db.select().from(absences).orderBy(desc(absences.date));
  }

  async getAbsencesByChild(childId: number): Promise<Absence[]> {
    return await db
      .select()
      .from(absences)
      .where(eq(absences.childId, childId))
      .orderBy(desc(absences.date));
  }

  async getAbsencesByDateRange(daycareId: number, startDate: Date, endDate: Date): Promise<Absence[]> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    return await db
      .select()
      .from(absences)
      .where(
        and(
          eq(absences.daycareId, daycareId),
          gte(absences.date, startDateStr),
          lte(absences.date, endDateStr)
        )
      )
      .orderBy(desc(absences.date));
  }

  async createAbsence(insertAbsence: InsertAbsence): Promise<Absence> {
    const [absence] = await db
      .insert(absences)
      .values(insertAbsence)
      .returning();
    return absence;
  }

  async getMessages(userId: number, daycareId: number, limit: number = LIST_LIMITS.messages, offset: number = 0): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.daycareId, daycareId),
          or(
            eq(messages.senderId, userId),
            eq(messages.recipientId, userId)
          )
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return message || undefined;
  }

  async getConversation(userId: number, otherUserId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, userId),
            eq(messages.recipientId, otherUserId)
          ),
          and(
            eq(messages.senderId, otherUserId),
            eq(messages.recipientId, userId)
          )
        )
      )
      .orderBy(messages.createdAt);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async markMessageAsRead(messageId: number): Promise<void> {
    await db
      .update(messages)
      .set({ read: true })
      .where(eq(messages.id, messageId));
  }

  async getUnreadCount(userId: number): Promise<number> {
    const unreadMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.read, false)
        )
      );
    return unreadMessages.length;
  }

  async getDocuments(daycareId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.daycareId, daycareId))
      .orderBy(desc(documents.publishedAt));
  }

  async getDocumentsByType(daycareId: number, type: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.daycareId, daycareId),
          eq(documents.type, type)
        )
      )
      .orderBy(desc(documents.publishedAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getNotifications(userId: number, limit: number = LIST_LIMITS.notifications, offset: number = 0): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getNotificationById(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return notification || undefined;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    // The notification bell polls this every 30 seconds for every signed-in user,
    // making it the most frequently executed query in the app. Let the database
    // return the number instead of shipping every unread row back to count them.
    const [row] = await db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        )
      );
    return row?.total ?? 0;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  /**
   * Insert many notifications in one statement.
   *
   * Notification fan-out (a new trip, a new entry, a reported absence) previously
   * inserted one row at a time in a loop, so announcing a trip to a daycare with
   * 150 guardians cost 150 sequential round trips. Returns the number inserted.
   */
  async createNotifications(list: InsertNotification[]): Promise<number> {
    if (list.length === 0) return 0;
    const inserted = await db.insert(notifications).values(list).returning({ id: notifications.id });
    return inserted.length;
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  /**
   * Every distinct guardian linked to any of the given children, in two queries
   * rather than two per child.
   */
  async getGuardiansForChildren(childIds: number[]): Promise<User[]> {
    if (childIds.length === 0) return [];

    const guardianRelations = await db
      .select({ userId: guardians.userId })
      .from(guardians)
      .where(inArray(guardians.childId, childIds));

    const userIds = Array.from(new Set(guardianRelations.map((g) => g.userId)));
    if (userIds.length === 0) return [];

    return await db.select().from(users).where(inArray(users.id, userIds));
  }

  /**
   * Children linked to each of the given guardians, in one query rather than one
   * per guardian. The staff-facing user list previously called
   * getChildrenByGuardian once per row, so opening it in a daycare with 150
   * guardians issued 150 extra queries.
   */
  async getChildrenByGuardians(userIds: number[]): Promise<Map<number, Child[]>> {
    const byGuardian = new Map<number, Child[]>();
    if (userIds.length === 0) return byGuardian;

    const rows = await db
      .select({ userId: guardians.userId, child: children })
      .from(guardians)
      .innerJoin(children, eq(guardians.childId, children.id))
      .where(inArray(guardians.userId, userIds));

    for (const row of rows) {
      const list = byGuardian.get(row.userId);
      if (list) list.push(row.child);
      else byGuardian.set(row.userId, [row.child]);
    }
    return byGuardian;
  }

  async getGuardiansForChild(childId: number): Promise<User[]> {
    const guardianRelations = await db
      .select()
      .from(guardians)
      .where(eq(guardians.childId, childId));
    
    if (guardianRelations.length === 0) return [];
    
    const userIds = guardianRelations.map(g => g.userId);
    return await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
  }

  async getStaffByDaycare(daycareId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.daycareId, daycareId),
          or(eq(users.role, 'staff'), eq(users.role, 'daycareleader'))
        )
      );
  }

  // Daycare Groups
  async getDaycareGroups(daycareId: number): Promise<DaycareGroup[]> {
    return await db
      .select()
      .from(daycareGroups)
      .where(eq(daycareGroups.daycareId, daycareId));
  }

  async getDaycareGroup(id: number): Promise<DaycareGroup | undefined> {
    const [group] = await db.select().from(daycareGroups).where(eq(daycareGroups.id, id));
    return group || undefined;
  }

  async getGroupById(id: number): Promise<DaycareGroup | undefined> {
    return this.getDaycareGroup(id);
  }

  async createDaycareGroup(insertGroup: InsertDaycareGroup): Promise<DaycareGroup> {
    const [group] = await db
      .insert(daycareGroups)
      .values(insertGroup)
      .returning();
    return group;
  }

  async deleteDaycareGroup(id: number): Promise<void> {
    await db.delete(teacherGroupAssignments).where(eq(teacherGroupAssignments.groupId, id));
    await db.update(children).set({ groupId: null }).where(eq(children.groupId, id));
    await db.delete(daycareGroups).where(eq(daycareGroups.id, id));
  }

  // Teacher Group Assignments
  async getTeacherGroups(userId: number): Promise<DaycareGroup[]> {
    const assignments = await db
      .select()
      .from(teacherGroupAssignments)
      .where(eq(teacherGroupAssignments.userId, userId));
    
    if (assignments.length === 0) return [];
    
    const groupIds = assignments.map(a => a.groupId);
    return await db
      .select()
      .from(daycareGroups)
      .where(inArray(daycareGroups.id, groupIds));
  }

  async getGroupTeachers(groupId: number): Promise<User[]> {
    const assignments = await db
      .select()
      .from(teacherGroupAssignments)
      .where(eq(teacherGroupAssignments.groupId, groupId));
    
    if (assignments.length === 0) return [];
    
    const userIds = assignments.map(a => a.userId);
    return await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
  }

  async assignTeacherToGroup(assignment: InsertTeacherGroupAssignment): Promise<TeacherGroupAssignment> {
    const [result] = await db
      .insert(teacherGroupAssignments)
      .values(assignment)
      .returning();
    return result;
  }

  async removeTeacherFromGroup(userId: number, groupId: number): Promise<void> {
    await db
      .delete(teacherGroupAssignments)
      .where(
        and(
          eq(teacherGroupAssignments.userId, userId),
          eq(teacherGroupAssignments.groupId, groupId)
        )
      );
  }

  // Children by Group (for teacher scoping)
  async getChildrenByGroup(groupId: number): Promise<Child[]> {
    return await db
      .select()
      .from(children)
      .where(eq(children.groupId, groupId));
  }

  async getChildrenByTeacherGroups(userId: number): Promise<Child[]> {
    const groups = await this.getTeacherGroups(userId);
    if (groups.length === 0) return [];
    
    const groupIds = groups.map(g => g.id);
    return await db
      .select()
      .from(children)
      .where(inArray(children.groupId, groupIds));
  }

  // Audit Logging (GDPR compliant - no personal data)
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return auditLog;
  }

  async getAuditLogs(daycareId?: number, limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    if (daycareId) {
      return await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.daycareId, daycareId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);
    }
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  // User Lifecycle
  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        passwordHash, 
        passwordNeedsReset: false,
        passwordChangedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiresAt: null
      })
      .where(eq(users.id, userId));
  }

  async setPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ 
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: expiresAt
      })
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(tokenHash: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetTokenHash, tokenHash));
    return user || undefined;
  }

  async clearPasswordResetToken(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ 
        resetTokenHash: null,
        resetTokenExpiresAt: null
      })
      .where(eq(users.id, userId));
  }

  async updateLastLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Aggregated Stats for Super Admin (NO personal data)
  async getMunicipalityStats(): Promise<{
    totalDaycares: number;
    totalChildren: number;
    totalStaff: number;
    totalGuardians: number;
    totalTrips: number;
    totalAbsencesToday: number;
    daycareStats: {
      daycareId: number;
      daycareName: string;
      childrenCount: number;
      staffCount: number;
      guardianCount: number;
    }[];
  }> {
    return await this.getAnonymizedStats();
  }

  // Super Admin specific (GDPR compliant)
  async getDaycareLeadersByDaycare(daycareId: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.daycareId, daycareId),
          eq(users.role, 'daycareleader')
        )
      );
  }

  async getAnonymizedStats(): Promise<{
    totalDaycares: number;
    totalChildren: number;
    totalStaff: number;
    totalGuardians: number;
    totalTrips: number;
    totalAbsencesToday: number;
    daycareStats: {
      daycareId: number;
      daycareName: string;
      childrenCount: number;
      staffCount: number;
      guardianCount: number;
    }[];
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Counted with GROUP BY aggregates rather than one set of queries per daycare.
    // The previous version issued five SELECT * per daycare and counted the rows in
    // JavaScript, so both the query count and the memory used grew with the number
    // of daycares. This is a fixed five queries no matter how many there are, and
    // the database returns counts instead of rows.
    const [allDaycares, childRows, userRows, tripRows, absenceRows] = await Promise.all([
      this.getAllDaycares(),
      db
        .select({ daycareId: children.daycareId, total: count() })
        .from(children)
        .groupBy(children.daycareId),
      db
        .select({ daycareId: users.daycareId, role: users.role, total: count() })
        .from(users)
        .where(inArray(users.role, ['staff', 'daycareleader', 'guardian']))
        .groupBy(users.daycareId, users.role),
      db
        .select({ daycareId: trips.daycareId, total: count() })
        .from(trips)
        .groupBy(trips.daycareId),
      db
        .select({ daycareId: absences.daycareId, total: count() })
        .from(absences)
        .where(eq(absences.date, today))
        .groupBy(absences.daycareId),
    ]);

    const childrenByDaycare = new Map<number, number>();
    for (const row of childRows) {
      if (row.daycareId !== null) childrenByDaycare.set(row.daycareId, row.total);
    }

    const staffByDaycare = new Map<number, number>();
    const guardiansByDaycare = new Map<number, number>();
    for (const row of userRows) {
      if (row.daycareId === null) continue;
      const target = row.role === 'guardian' ? guardiansByDaycare : staffByDaycare;
      target.set(row.daycareId, (target.get(row.daycareId) ?? 0) + row.total);
    }

    const tripsByDaycare = new Map<number, number>();
    for (const row of tripRows) {
      if (row.daycareId !== null) tripsByDaycare.set(row.daycareId, row.total);
    }

    const absencesTodayByDaycare = new Map<number, number>();
    for (const row of absenceRows) {
      if (row.daycareId !== null) absencesTodayByDaycare.set(row.daycareId, row.total);
    }

    let totalChildren = 0;
    let totalStaff = 0;
    let totalGuardians = 0;
    let totalTrips = 0;
    let totalAbsencesToday = 0;

    // Totals are accumulated over allDaycares, matching the previous behaviour:
    // rows pointing at a daycare that no longer exists are not counted.
    const daycareStats = allDaycares.map((daycare) => {
      const childrenCount = childrenByDaycare.get(daycare.id) ?? 0;
      const staffCount = staffByDaycare.get(daycare.id) ?? 0;
      const guardianCount = guardiansByDaycare.get(daycare.id) ?? 0;

      totalChildren += childrenCount;
      totalStaff += staffCount;
      totalGuardians += guardianCount;
      totalTrips += tripsByDaycare.get(daycare.id) ?? 0;
      totalAbsencesToday += absencesTodayByDaycare.get(daycare.id) ?? 0;

      return {
        daycareId: daycare.id,
        daycareName: daycare.name,
        childrenCount,
        staffCount,
        guardianCount,
      };
    });
    
    return {
      totalDaycares: allDaycares.length,
      totalChildren,
      totalStaff,
      totalGuardians,
      totalTrips,
      totalAbsencesToday,
      daycareStats,
    };
  }

  async getDaycareStats(daycareId: number): Promise<{
    childrenCount: number;
    staffCount: number;
    guardianCount: number;
    absencesToday: number;
    attendanceRate: number;
    entriesToday: number;
    entryBreakdown: {
      sleep: number;
      meal: number;
      play: number;
      incident: number;
    };
    activeTrips: number;
    pendingForms: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    // This powers the dashboard, so it runs on nearly every sign-in. Every figure
    // below is a count, so the database computes them; previously each one pulled
    // the full set of matching rows back only to read their .length. The queries
    // are independent, so they also run concurrently rather than one after another.
    const [
      childrenCountRows,
      staffCountRows,
      guardianCountRows,
      todayAbsenceRows,
      entryBreakdownRows,
      activeTripRows,
      activeFormRows,
    ] = await Promise.all([
      db
        .select({ total: count() })
        .from(children)
        .where(eq(children.daycareId, daycareId)),
      db
        .select({ total: count() })
        .from(users)
        .where(
          and(
            eq(users.daycareId, daycareId),
            or(eq(users.role, 'staff'), eq(users.role, 'daycareleader'))
          )
        ),
      db
        .select({ total: count() })
        .from(users)
        .where(
          and(
            eq(users.daycareId, daycareId),
            eq(users.role, 'guardian')
          )
        ),
      db
        .select({ total: count() })
        .from(absences)
        .where(
          and(
            eq(absences.daycareId, daycareId),
            eq(absences.date, today)
          )
        ),
      // One grouped query replaces fetching today's entries and filtering by type
      // five times in JavaScript.
      db
        .select({ type: entries.type, total: count() })
        .from(entries)
        .innerJoin(children, eq(entries.childId, children.id))
        .where(
          and(
            eq(children.daycareId, daycareId),
            gte(entries.timestamp, todayDate)
          )
        )
        .groupBy(entries.type),
      db
        .select({ total: count() })
        .from(trips)
        .where(
          and(
            eq(trips.daycareId, daycareId),
            gte(trips.date, today)
          )
        ),
      db
        .select({ total: count() })
        .from(forms)
        .where(
          and(
            eq(forms.daycareId, daycareId),
            eq(forms.isActive, true)
          )
        ),
    ]);
    
    const countsByEntryType = new Map(entryBreakdownRows.map((row) => [row.type, row.total]));
    // The four types the application can actually record, as offered by the entry
    // form. The breakdown previously counted 'activity', 'arrival' and 'mood',
    // which nothing ever writes, so a leader's dashboard reported three permanent
    // zeroes and never counted the play entries that do exist.
    const entryBreakdown = {
      sleep: countsByEntryType.get('sleep') ?? 0,
      meal: countsByEntryType.get('meal') ?? 0,
      play: countsByEntryType.get('play') ?? 0,
      incident: countsByEntryType.get('incident') ?? 0,
    };

    // entriesToday counts every entry logged today, including types absent from the
    // breakdown above, so it sums the grouped rows rather than the five named ones.
    const entriesToday = entryBreakdownRows.reduce((sum, row) => sum + row.total, 0);

    const childrenCount = childrenCountRows[0]?.total ?? 0;
    const absencesToday = todayAbsenceRows[0]?.total ?? 0;
    const attendanceRate = childrenCount > 0 
      ? Math.round(((childrenCount - absencesToday) / childrenCount) * 100) 
      : 100;
    
    return {
      childrenCount,
      staffCount: staffCountRows[0]?.total ?? 0,
      guardianCount: guardianCountRows[0]?.total ?? 0,
      absencesToday,
      attendanceRate,
      entriesToday,
      entryBreakdown,
      activeTrips: activeTripRows[0]?.total ?? 0,
      pendingForms: activeFormRows[0]?.total ?? 0,
    };
  }

  // Meal Menu methods
  async getMealMenuByDate(date: string, daycareId?: number): Promise<MealMenu[]> {
    // Filter out items with no food name (empty menu items)
    const filterEmptyItems = (items: MealMenu[]) => items.filter(item => item.foodName && item.foodName.trim() !== '');
    
    if (daycareId) {
      // First try to get daycare-specific menus
      const daycareMenus = await db
        .select()
        .from(mealMenus)
        .where(and(eq(mealMenus.date, date), eq(mealMenus.daycareId, daycareId)));
      
      const filtered = filterEmptyItems(daycareMenus);
      
      // If no valid daycare-specific menus, fall back to global menus (null daycareId)
      if (filtered.length === 0) {
        const globalMenus = await db
          .select()
          .from(mealMenus)
          .where(and(eq(mealMenus.date, date), isNull(mealMenus.daycareId)));
        return filterEmptyItems(globalMenus);
      }
      return filtered;
    }
    const allMenus = await db
      .select()
      .from(mealMenus)
      .where(eq(mealMenus.date, date));
    return filterEmptyItems(allMenus);
  }

  async getMealMenuByDateRange(startDate: string, endDate: string, daycareId?: number): Promise<MealMenu[]> {
    // Filter out items with no food name (empty menu items)
    const filterEmptyItems = (items: MealMenu[]) => items.filter(item => item.foodName && item.foodName.trim() !== '');
    
    if (daycareId) {
      const daycareMenus = await db
        .select()
        .from(mealMenus)
        .where(and(
          gte(mealMenus.date, startDate),
          lte(mealMenus.date, endDate),
          eq(mealMenus.daycareId, daycareId)
        ))
        .orderBy(asc(mealMenus.date));
      
      const filtered = filterEmptyItems(daycareMenus);
      
      if (filtered.length === 0) {
        const globalMenus = await db
          .select()
          .from(mealMenus)
          .where(and(
            gte(mealMenus.date, startDate),
            lte(mealMenus.date, endDate),
            isNull(mealMenus.daycareId)
          ))
          .orderBy(asc(mealMenus.date));
        return filterEmptyItems(globalMenus);
      }
      return filtered;
    }
    const allMenus = await db
      .select()
      .from(mealMenus)
      .where(and(
        gte(mealMenus.date, startDate),
        lte(mealMenus.date, endDate)
      ))
      .orderBy(asc(mealMenus.date));
    return filterEmptyItems(allMenus);
  }

  async getLatestMealMenu(daycareId?: number): Promise<MealMenu[]> {
    // Get the most recent date that has menu items
    const query = daycareId
      ? db.select({ date: mealMenus.date }).from(mealMenus).where(eq(mealMenus.daycareId, daycareId)).orderBy(desc(mealMenus.date)).limit(1)
      : db.select({ date: mealMenus.date }).from(mealMenus).orderBy(desc(mealMenus.date)).limit(1);
    
    const latestDate = await query;
    
    if (latestDate.length === 0) {
      return [];
    }
    
    if (daycareId) {
      return await db
        .select()
        .from(mealMenus)
        .where(and(eq(mealMenus.date, latestDate[0].date), eq(mealMenus.daycareId, daycareId)));
    }
    return await db
      .select()
      .from(mealMenus)
      .where(eq(mealMenus.date, latestDate[0].date));
  }

  async createMealMenu(menu: InsertMealMenu): Promise<MealMenu> {
    const [createdMenu] = await db
      .insert(mealMenus)
      .values(menu)
      .returning();
    return createdMenu;
  }

  async deleteMealMenuByDate(date: string, daycareId?: number): Promise<void> {
    if (daycareId) {
      await db.delete(mealMenus).where(and(eq(mealMenus.date, date), eq(mealMenus.daycareId, daycareId)));
    } else {
      await db.delete(mealMenus).where(eq(mealMenus.date, date));
    }
  }
  
  // Daycare menu settings
  async updateDaycareMenuSettings(daycareId: number, settings: { municipality?: string; menuSourceType?: string; menuSourceUrl?: string }): Promise<Daycare> {
    const [updated] = await db
      .update(daycares)
      .set(settings)
      .where(eq(daycares.id, daycareId))
      .returning();
    return updated;
  }
  
  async getDaycaresByMenuSource(menuSourceType: string): Promise<Daycare[]> {
    return await db
      .select()
      .from(daycares)
      .where(eq(daycares.menuSourceType, menuSourceType));
  }
  
  // Forms system
  async getForms(daycareId: number): Promise<Form[]> {
    return await db
      .select()
      .from(forms)
      .where(eq(forms.daycareId, daycareId))
      .orderBy(desc(forms.createdAt));
  }
  
  async getForm(id: number): Promise<Form | undefined> {
    const [form] = await db.select().from(forms).where(eq(forms.id, id));
    return form || undefined;
  }
  
  async getActiveForms(daycareId: number): Promise<Form[]> {
    return await db
      .select()
      .from(forms)
      .where(and(eq(forms.daycareId, daycareId), eq(forms.isActive, true)))
      .orderBy(desc(forms.createdAt));
  }
  
  async createForm(form: InsertForm): Promise<Form> {
    const [created] = await db
      .insert(forms)
      .values(form)
      .returning();
    return created;
  }
  
  async updateForm(id: number, updates: Partial<InsertForm>): Promise<Form> {
    const [updated] = await db
      .update(forms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(forms.id, id))
      .returning();
    return updated;
  }
  
  async deleteForm(id: number): Promise<void> {
    // First delete all submissions for this form
    await db.delete(formSubmissions).where(eq(formSubmissions.formId, id));
    // Then delete the form
    await db.delete(forms).where(eq(forms.id, id));
  }
  
  // Form Submissions
  async getFormSubmissions(formId: number): Promise<FormSubmission[]> {
    return await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, formId))
      .orderBy(desc(formSubmissions.submittedAt));
  }
  
  async getFormSubmissionsByChild(childId: number): Promise<FormSubmission[]> {
    return await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.childId, childId))
      .orderBy(desc(formSubmissions.submittedAt));
  }
  
  async getFormSubmissionsByUser(userId: number): Promise<FormSubmission[]> {
    return await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.submittedById, userId))
      .orderBy(desc(formSubmissions.submittedAt));
  }
  
  async getFormSubmission(id: number): Promise<FormSubmission | undefined> {
    const [submission] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, id));
    return submission || undefined;
  }
  
  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const [created] = await db
      .insert(formSubmissions)
      .values(submission)
      .returning();
    return created;
  }
  
  async checkFormSubmissionExists(formId: number, childId?: number, userId?: number): Promise<boolean> {
    let conditions = [eq(formSubmissions.formId, formId)];
    if (childId) conditions.push(eq(formSubmissions.childId, childId));
    if (userId) conditions.push(eq(formSubmissions.submittedById, userId));
    
    const existing = await db
      .select()
      .from(formSubmissions)
      .where(and(...conditions))
      .limit(1);
    return existing.length > 0;
  }
  
  // Child Consents
  async getChildConsents(childId: number): Promise<ChildConsent[]> {
    return await db
      .select()
      .from(childConsents)
      .where(eq(childConsents.childId, childId));
  }
  
  async getChildConsentsByDaycare(daycareId: number): Promise<ChildConsent[]> {
    return await db
      .select()
      .from(childConsents)
      .where(eq(childConsents.daycareId, daycareId));
  }
  
  async getChildConsent(childId: number, consentType: string): Promise<ChildConsent | undefined> {
    const [consent] = await db
      .select()
      .from(childConsents)
      .where(and(eq(childConsents.childId, childId), eq(childConsents.consentType, consentType)));
    return consent || undefined;
  }
  
  async createOrUpdateChildConsent(consent: InsertChildConsent): Promise<ChildConsent> {
    // Check if consent already exists
    const existing = await this.getChildConsent(consent.childId, consent.consentType);
    
    if (existing) {
      const [updated] = await db
        .update(childConsents)
        .set({
          granted: consent.granted,
          grantedById: consent.grantedById,
          notes: consent.notes,
          updatedAt: new Date(),
        })
        .where(eq(childConsents.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(childConsents)
      .values(consent)
      .returning();
    return created;
  }
  
  async deleteChildConsent(id: number): Promise<void> {
    await db.delete(childConsents).where(eq(childConsents.id, id));
  }
  
  // Push Tokens
  async savePushToken(userId: number, token: string, platform: string): Promise<PushToken> {
    // Check if token already exists for this user
    const [existing] = await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
    
    if (existing) {
      const [updated] = await db
        .update(pushTokens)
        .set({ updatedAt: new Date() })
        .where(eq(pushTokens.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(pushTokens)
      .values({ userId, token, platform })
      .returning();
    return created;
  }
  
  async getPushTokensByUser(userId: number): Promise<PushToken[]> {
    return await db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  }
  
  async getPushTokensByUsers(userIds: number[]): Promise<PushToken[]> {
    if (userIds.length === 0) return [];
    return await db.select().from(pushTokens).where(inArray(pushTokens.userId, userIds));
  }
  
  async deletePushToken(userId: number, token: string): Promise<void> {
    await db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }
  
  // Health Check - verify database connection
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      // Simple query to verify database is responding
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
  
  // GDPR Delete Requests
  async createDeleteRequest(request: InsertDeleteRequest): Promise<DeleteRequest> {
    const [created] = await db
      .insert(deleteRequests)
      .values(request)
      .returning();
    return created;
  }
  
  async getDeleteRequests(daycareId?: number): Promise<DeleteRequest[]> {
    if (daycareId) {
      return await db
        .select()
        .from(deleteRequests)
        .where(eq(deleteRequests.daycareId, daycareId))
        .orderBy(desc(deleteRequests.createdAt));
    }
    return await db
      .select()
      .from(deleteRequests)
      .orderBy(desc(deleteRequests.createdAt));
  }
  
  async getDeleteRequestsByUser(userId: number): Promise<DeleteRequest[]> {
    return await db
      .select()
      .from(deleteRequests)
      .where(eq(deleteRequests.userId, userId))
      .orderBy(desc(deleteRequests.createdAt));
  }
  
  async getDeleteRequest(id: number): Promise<DeleteRequest | undefined> {
    const [request] = await db
      .select()
      .from(deleteRequests)
      .where(eq(deleteRequests.id, id));
    return request || undefined;
  }
  
  async updateDeleteRequestStatus(id: number, status: string, processedById: number, adminNote?: string): Promise<DeleteRequest> {
    const [updated] = await db
      .update(deleteRequests)
      .set({
        status,
        processedById,
        adminNote,
        processedAt: new Date(),
      })
      .where(eq(deleteRequests.id, id))
      .returning();
    return updated;
  }
  
  // GDPR Data Export - returns all data for a guardian user
  async getGuardianDataExport(userId: number): Promise<{
    user: Omit<User, 'passwordHash' | 'resetTokenHash'>;
    children: Child[];
    entries: Entry[];
    tripResponses: TripResponse[];
    messages: Message[];
    absences: Absence[];
    formSubmissions: FormSubmission[];
  }> {
    // Get user without sensitive fields
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Remove sensitive data
    const { passwordHash, resetTokenHash, ...safeUser } = user;
    
    // Get children linked to this guardian
    const userChildren = await this.getChildrenByGuardian(userId);
    const childIds = userChildren.map(c => c.id);
    
    // A GDPR subject access request must be complete, so these queries deliberately
    // bypass the LIST_LIMITS caps that the interactive endpoints use. One query per
    // table over all of the guardian's children, rather than one query per child.
    const [userEntries, userAbsences, userTripResponses, userMessages, userFormSubmissions] =
      await Promise.all([
        childIds.length
          ? db
              .select()
              .from(entries)
              .where(inArray(entries.childId, childIds))
              .orderBy(desc(entries.timestamp))
          : Promise.resolve([] as Entry[]),
        childIds.length
          ? db
              .select()
              .from(absences)
              .where(inArray(absences.childId, childIds))
              .orderBy(desc(absences.date))
          : Promise.resolve([] as Absence[]),
        this.getTripResponsesByGuardian(userId),
        user.daycareId
          ? db
              .select()
              .from(messages)
              .where(
                and(
                  eq(messages.daycareId, user.daycareId),
                  or(eq(messages.senderId, userId), eq(messages.recipientId, userId))
                )
              )
              .orderBy(desc(messages.createdAt))
          : Promise.resolve([] as Message[]),
        this.getFormSubmissionsByUser(userId),
      ]);
    
    return {
      user: safeUser,
      children: userChildren,
      entries: userEntries,
      tripResponses: userTripResponses,
      messages: userMessages,
      absences: userAbsences,
      formSubmissions: userFormSubmissions,
    };
  }
  
  // Session Token Management (VAHTI compliance - secure logout)
  async createSessionToken(userId: number, tokenHash: string, expiresAt: Date): Promise<SessionToken> {
    const [token] = await db
      .insert(sessionTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    return token;
  }
  
  async getSessionToken(tokenHash: string): Promise<SessionToken | undefined> {
    const [token] = await db
      .select()
      .from(sessionTokens)
      .where(eq(sessionTokens.tokenHash, tokenHash));
    return token || undefined;
  }

  /**
   * Resolve the authenticated user and their session token in a single round trip.
   *
   * The auth middleware runs on every request, so fetching the user and then the
   * session token separately doubled the latency floor of the whole API. Joining
   * them costs one query instead of two; session_tokens.token_hash is unique, so
   * this matches at most one row.
   */
  async getUserBySessionToken(
    tokenHash: string
  ): Promise<{ user: User; sessionToken: SessionToken } | undefined> {
    const [row] = await db
      .select({ user: users, sessionToken: sessionTokens })
      .from(sessionTokens)
      .innerJoin(users, eq(users.id, sessionTokens.userId))
      .where(eq(sessionTokens.tokenHash, tokenHash))
      .limit(1);
    return row || undefined;
  }
  
  async deleteSessionToken(tokenHash: string): Promise<void> {
    await db.delete(sessionTokens).where(eq(sessionTokens.tokenHash, tokenHash));
  }
  
  async deleteUserSessionTokens(userId: number): Promise<void> {
    await db.delete(sessionTokens).where(eq(sessionTokens.userId, userId));
  }
  
  async deleteExpiredSessionTokens(): Promise<number> {
    const result = await db
      .delete(sessionTokens)
      .where(lte(sessionTokens.expiresAt, new Date()))
      .returning();
    return result.length;
  }
  
  // Account Lockout (VAHTI compliance - brute force protection)
  async incrementFailedLoginAttempts(userId: number): Promise<number> {
    const [updated] = await db
      .update(users)
      .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1` })
      .where(eq(users.id, userId))
      .returning();
    return updated.failedLoginAttempts;
  }
  
  async resetFailedLoginAttempts(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, userId));
  }
  
  async lockUserAccount(userId: number, lockUntil: Date): Promise<void> {
    await db
      .update(users)
      .set({ lockedUntil: lockUntil })
      .where(eq(users.id, userId));
  }
  
  async unlockUserAccount(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, userId));
  }
  
  async isUserLocked(userId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || !user.lockedUntil) return false;
    return new Date(user.lockedUntil) > new Date();
  }
  
  // GDPR Data Retention (automated cleanup)
  async cleanupOldAuditLogs(retentionMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    const result = await db
      .delete(auditLogs)
      .where(lte(auditLogs.timestamp, cutoffDate))
      .returning();
    return result.length;
  }
  
  async cleanupOldMessages(retentionMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    const result = await db
      .delete(messages)
      .where(lte(messages.createdAt, cutoffDate))
      .returning();
    return result.length;
  }
  
  async cleanupOldTrips(retentionMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    // First delete trip responses for old trips
    const oldTrips = await db
      .select({ id: trips.id })
      .from(trips)
      .where(lte(trips.createdAt, cutoffDate));
    
    const tripIds = oldTrips.map(t => t.id);
    if (tripIds.length > 0) {
      await db.delete(tripResponses).where(inArray(tripResponses.tripId, tripIds));
    }
    
    const result = await db
      .delete(trips)
      .where(lte(trips.createdAt, cutoffDate))
      .returning();
    return result.length;
  }
  
  async cleanupOldAbsences(retentionMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    const result = await db
      .delete(absences)
      .where(lte(absences.createdAt, cutoffDate))
      .returning();
    return result.length;
  }
  
  async cleanupOldNotifications(retentionMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    const result = await db
      .delete(notifications)
      .where(lte(notifications.createdAt, cutoffDate))
      .returning();
    return result.length;
  }
  
  async cleanupOldEntries(retentionMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    
    const result = await db
      .delete(entries)
      .where(lte(entries.timestamp, cutoffDate))
      .returning();
    return result.length;
  }
}

export const storage = new DatabaseStorage();

// Helper function to hash entity IDs for audit logs (GDPR compliance)
export function hashEntityId(id: number | string): string {
  return crypto.createHash('sha256').update(String(id)).digest('hex').substring(0, 16);
}
