/**
 * product.assistant-conversation-history — tenant-scoped persistence for the
 * commercial runtime's assistant Q&A continuity.
 *
 * This is a SUPPORTING SERVICE, not an Engine and not a coordinator. It exists
 * because the commercial runtime's `/api/assistant` path persisted nothing, so a
 * returning user could not list or retrieve previous conversations. It records
 * only the user's own question and the runtime's answer, scoped by tenant, so
 * the canonical RBAC and tenant-isolation boundaries continue to hold.
 *
 * Boundary notes:
 *   - No calculation, reasoning or financial semantics live here.
 *   - The legacy in-memory `ConversationEngine` (duplicated under Core/ and
 *     Engines/) is intentionally NOT reused: it is not tenant-scoped, not
 *     persistence-backed and not wired into the commercial runtime. Whether that
 *     legacy duplication should be consolidated is a separate Architecture
 *     Change Control item and is not touched here.
 *   - The store is bounded: only the most recent `maxConversations` records are
 *     retained per tenant.
 */
import { randomUUID } from "node:crypto";
import type { SQLitePersistenceStore } from "./SQLitePersistenceStore";

export interface AssistantConversationRecord {
  readonly conversationId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly username: string;
  readonly question: string;
  readonly answer: string;
  readonly createdAt: string;
  readonly sourceSha256?: string;
}

export interface RecordConversationInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly username: string;
  readonly question: string;
  readonly answer: string;
  readonly sourceSha256?: string;
}

export interface ConversationPage {
  readonly items: readonly AssistantConversationRecord[];
  readonly total: number;
}

const INDEX_KEY = "assistant-conversation:index";
const RECORD_PREFIX = "assistant-conversation:";
const DEFAULT_MAX_CONVERSATIONS = 200;

const recordKey = (conversationId: string): string => `${RECORD_PREFIX}${conversationId}`;

export class AssistantConversationHistory {
  private readonly persistence: SQLitePersistenceStore;
  private readonly now: () => number;
  private readonly maxConversations: number;
  private readonly cache = new Map<string, AssistantConversationRecord>();

  constructor(
    persistence: SQLitePersistenceStore,
    now: () => number = () => Date.now(),
    maxConversations: number = DEFAULT_MAX_CONVERSATIONS,
  ) {
    this.persistence = persistence;
    this.now = now;
    this.maxConversations = Number.isInteger(maxConversations) && maxConversations > 0
      ? maxConversations
      : DEFAULT_MAX_CONVERSATIONS;
  }

  async record(input: RecordConversationInput): Promise<AssistantConversationRecord> {
    const record: AssistantConversationRecord = Object.freeze({
      conversationId: `conv-${this.now()}-${randomUUID().slice(0, 8)}`,
      tenantId: input.tenantId,
      userId: input.userId,
      username: input.username,
      question: input.question,
      answer: input.answer,
      createdAt: new Date(this.now()).toISOString(),
      ...(input.sourceSha256 ? { sourceSha256: input.sourceSha256 } : {}),
    });
    this.cache.set(record.conversationId, record);
    await this.persistence.write({ tenantId: record.tenantId }, recordKey(record.conversationId), record);
    await this.prependToIndex(record.tenantId, record.conversationId);
    return record;
  }

  async list(tenantId: string, limit: number, offset: number): Promise<ConversationPage> {
    const ids = await this.readIndex(tenantId);
    const items: AssistantConversationRecord[] = [];
    for (const id of ids) {
      const record = await this.get(tenantId, id);
      if (record) items.push(record);
    }
    const total = items.length;
    return { items: items.slice(offset, offset + limit), total };
  }

  async get(tenantId: string, conversationId: string): Promise<AssistantConversationRecord | null> {
    if (!conversationId) return null;
    const cached = this.cache.get(conversationId);
    if (cached && cached.tenantId === tenantId) return cached;
    const record = await this.persistence.read({ tenantId }, recordKey(conversationId));
    const value = record?.value as AssistantConversationRecord | undefined;
    if (!value || value.tenantId !== tenantId) return null;
    this.cache.set(value.conversationId, value);
    return value;
  }

  private async readIndex(tenantId: string): Promise<string[]> {
    const record = await this.persistence.read({ tenantId }, INDEX_KEY);
    const ids = Array.isArray(record?.value)
      ? (record.value as unknown[]).filter((value): value is string => typeof value === "string")
      : [];
    return ids;
  }

  private async prependToIndex(tenantId: string, conversationId: string): Promise<void> {
    const ids = await this.readIndex(tenantId);
    const next = [conversationId, ...ids.filter((id) => id !== conversationId)];
    const retained = next.slice(0, this.maxConversations);
    const evicted = next.slice(this.maxConversations);
    await this.persistence.write({ tenantId }, INDEX_KEY, retained);
    for (const id of evicted) {
      this.cache.delete(id);
      await this.persistence.delete({ tenantId }, recordKey(id));
    }
  }
}
