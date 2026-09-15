import { DurableObject } from "cloudflare:workers";
import { AppError, ErrorCodes } from "../errors/codes";

export interface ApprovalRecord {
  id: string;
  subject: string;
  operationId: string;
  argsHash: string;
  status: "pending" | "approved" | "rejected" | "consumed" | "expired";
  createdAt: number;
  expiresAt: number;
  executionId?: string;
}

/** Per-user Durable Object for mutation approvals. */
export class MutationApprovalsDO extends DurableObject {
  async create(input: {
    subject: string;
    operationId: string;
    argsHash: string;
    ttlMs?: number;
  }): Promise<ApprovalRecord> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const record: ApprovalRecord = {
      id,
      subject: input.subject,
      operationId: input.operationId,
      argsHash: input.argsHash,
      status: "pending",
      createdAt: now,
      expiresAt: now + (input.ttlMs ?? 15 * 60_000),
    };
    await this.ctx.storage.put(`approval:${id}`, record);
    await this.ctx.storage.put(`latest:${input.subject}:${input.operationId}:${input.argsHash}`, id);
    return record;
  }

  async approve(id: string, subject: string): Promise<ApprovalRecord> {
    const record = await this.#get(id);
    this.#assertOwner(record, subject);
    this.#assertFresh(record);
    if (record.status !== "pending") {
      throw new AppError(ErrorCodes.INVALID_INPUT, `Cannot approve ${record.status}`);
    }
    record.status = "approved";
    await this.ctx.storage.put(`approval:${id}`, record);
    return record;
  }

  async consume(input: {
    subject: string;
    operationId: string;
    argsHash: string;
    executionId: string;
  }): Promise<ApprovalRecord> {
    const id = await this.ctx.storage.get<string>(
      `latest:${input.subject}:${input.operationId}:${input.argsHash}`,
    );
    if (!id) {
      throw new AppError(ErrorCodes.APPROVAL_REQUIRED, "No approval found");
    }
    const record = await this.#get(id);
    this.#assertOwner(record, input.subject);
    this.#assertFresh(record);
    if (record.status !== "approved") {
      throw new AppError(
        ErrorCodes.APPROVAL_REQUIRED,
        `Approval status is ${record.status}`,
      );
    }
    record.status = "consumed";
    record.executionId = input.executionId;
    await this.ctx.storage.put(`approval:${id}`, record);
    return record;
  }

  async get(id: string): Promise<ApprovalRecord | null> {
    return (await this.ctx.storage.get<ApprovalRecord>(`approval:${id}`)) ?? null;
  }

  async #get(id: string): Promise<ApprovalRecord> {
    const record = await this.get(id);
    if (!record) {
      throw new AppError(ErrorCodes.APPROVAL_REQUIRED, "Approval not found");
    }
    return record;
  }

  #assertOwner(record: ApprovalRecord, subject: string): void {
    if (record.subject !== subject) {
      throw new AppError(ErrorCodes.FORBIDDEN, "Approval subject mismatch");
    }
  }

  #assertFresh(record: ApprovalRecord): void {
    if (Date.now() > record.expiresAt) {
      record.status = "expired";
      void this.ctx.storage.put(`approval:${record.id}`, record);
      throw new AppError(ErrorCodes.APPROVAL_REQUIRED, "Approval expired");
    }
  }
}

export async function hashArgs(args: unknown): Promise<string> {
  const data = new TextEncoder().encode(stableStringify(args));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
