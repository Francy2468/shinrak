import { 
  users, products, licenses, hwidBans, scripts, executionLogs,
  invites, obfuscationLogs,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type License, type InsertLicense,
  type HwidBan, type InsertHwidBan,
  type Script, type InsertScript,
  type ExecutionLog,
  type Invite, type InsertInvite
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth"; // Re-use existing auth storage

export interface IStorage {
  // Auth users
  getUser(id: string): Promise<User | undefined>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;

  // Licenses
  getLicenses(): Promise<License[]>;
  getLicense(id: number): Promise<License | undefined>;
  getLicenseByKey(key: string): Promise<License | undefined>;
  createLicense(license: InsertLicense): Promise<License>;
  deleteLicense(id: number): Promise<void>;
  updateLicense(id: number, updates: Partial<License>): Promise<License>;
  
  // Bans
  getHwidBans(): Promise<HwidBan[]>;
  createHwidBan(ban: InsertHwidBan): Promise<HwidBan>;
  deleteHwidBan(id: number): Promise<void>;
  getHwidBan(hwid: string): Promise<HwidBan | undefined>;

  // Scripts
  getScriptByProductId(productId: number): Promise<Script | undefined>;
  upsertScript(script: InsertScript): Promise<Script>;

  // Logs
  getLogs(): Promise<ExecutionLog[]>;
  createLog(log: Omit<ExecutionLog, "id" | "executedAt">): Promise<ExecutionLog>;

  // Invites & Obfuscation
  getInvite(code: string): Promise<Invite | undefined>;
  createInvite(invite: InsertInvite): Promise<Invite>;
  useInvite(code: string, userId: string): Promise<void>;
  getObfuscationCount(userId: string, month: string): Promise<number>;
  incrementObfuscationCount(userId: string, month: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Auth
  async getUser(id: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  // Invites & Obfuscation
  async getInvite(code: string): Promise<Invite | undefined> {
    const [i] = await db.select().from(invites).where(eq(invites.code, code));
    return i;
  }
  async createInvite(invite: InsertInvite): Promise<Invite> {
    const [i] = await db.insert(invites).values(invite).returning();
    return i;
  }
  async useInvite(code: string, userId: string): Promise<void> {
    const invite = await this.getInvite(code);
    if (!invite) return;
    await db.update(invites).set({ isUsed: true, usedBy: userId }).where(eq(invites.code, code));
    await db.update(users).set({ tier: invite.tier }).where(eq(users.id, userId));
  }
  async getObfuscationCount(userId: string, month: string): Promise<number> {
    const [log] = await db.select().from(obfuscationLogs).where(and(eq(obfuscationLogs.userId, userId), eq(obfuscationLogs.month, month)));
    return log?.count || 0;
  }
  async incrementObfuscationCount(userId: string, month: string): Promise<void> {
    const count = await this.getObfuscationCount(userId, month);
    if (count === 0) {
      await db.insert(obfuscationLogs).values({ userId, month, count: 1 });
    } else {
      await db.update(obfuscationLogs).set({ count: count + 1 }).where(and(eq(obfuscationLogs.userId, userId), eq(obfuscationLogs.month, month)));
    }
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.createdAt));
  }
  async getProduct(id: number): Promise<Product | undefined> {
    const [p] = await db.select().from(products).where(eq(products.id, id));
    return p;
  }
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(insertProduct).returning();
    return p;
  }
  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
    const [p] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return p;
  }
  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Licenses
  async getLicenses(): Promise<License[]> {
    return db.select().from(licenses).orderBy(desc(licenses.createdAt));
  }
  async getLicense(id: number): Promise<License | undefined> {
    const [l] = await db.select().from(licenses).where(eq(licenses.id, id));
    return l;
  }
  async getLicenseByKey(key: string): Promise<License | undefined> {
    const [l] = await db.select().from(licenses).where(eq(licenses.key, key));
    return l;
  }
  async createLicense(insertLicense: InsertLicense): Promise<License> {
    const [l] = await db.insert(licenses).values(insertLicense).returning();
    return l;
  }
  async deleteLicense(id: number): Promise<void> {
    await db.delete(licenses).where(eq(licenses.id, id));
  }
  async updateLicense(id: number, updates: Partial<License>): Promise<License> {
    const [l] = await db.update(licenses).set(updates).where(eq(licenses.id, id)).returning();
    return l;
  }

  // HWID Bans
  async getHwidBans(): Promise<HwidBan[]> {
    return db.select().from(hwidBans).orderBy(desc(hwidBans.bannedAt));
  }
  async createHwidBan(ban: InsertHwidBan): Promise<HwidBan> {
    const [b] = await db.insert(hwidBans).values(ban).returning();
    return b;
  }
  async deleteHwidBan(id: number): Promise<void> {
    await db.delete(hwidBans).where(eq(hwidBans.id, id));
  }
  async getHwidBan(hwid: string): Promise<HwidBan | undefined> {
    const [b] = await db.select().from(hwidBans).where(eq(hwidBans.hwid, hwid));
    return b;
  }

  // Scripts
  async getScriptByProductId(productId: number): Promise<Script | undefined> {
    const [s] = await db.select().from(scripts).where(eq(scripts.productId, productId));
    return s;
  }
  async upsertScript(insertScript: InsertScript): Promise<Script> {
    const [s] = await db.insert(scripts).values(insertScript)
      .onConflictDoUpdate({
        target: scripts.productId,
        set: { content: insertScript.content, isObfuscated: insertScript.isObfuscated, updatedAt: new Date() }
      })
      .returning();
    return s;
  }

  // Logs
  async getLogs(): Promise<ExecutionLog[]> {
    return db.select().from(executionLogs).orderBy(desc(executionLogs.executedAt)).limit(100);
  }
  async createLog(log: Omit<ExecutionLog, "id" | "executedAt">): Promise<ExecutionLog> {
    const [l] = await db.insert(executionLogs).values(log).returning();
    return l;
  }
}

export const storage = new DatabaseStorage();
