export type AuditEntry = {
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
};

/** Appends one entry to the append-only audit log, on the caller's transaction. */
export async function insertAudit(db: { query(sql: string, params: unknown[]): Promise<unknown> }, entry: AuditEntry) {
  await db.query(
    'insert into audit_log (tenant_id, actor_id, action, entity_type, entity_id, detail) values ($1, $2, $3, $4, $5, $6)',
    [entry.tenantId, entry.actorId, entry.action, entry.entityType, entry.entityId, JSON.stringify(entry.detail)],
  );
}
