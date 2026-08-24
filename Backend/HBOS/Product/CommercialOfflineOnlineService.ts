export interface OfflineOperation {
  id: string;
  tenantId: string;
  type: string;
  payload: unknown;
}

export interface ReplayResult { replayed: number; remaining: number; }

export class CommercialOfflineOnlineService {
  private online = true;
  private readonly queue: OfflineOperation[] = [];

  setOnline(online: boolean): void { this.online = online; }
  isOnline(): boolean { return this.online; }

  submit(operation: OfflineOperation, send: (operation: OfflineOperation) => void): "SENT" | "QUEUED" {
    if (!this.online) {
      this.queue.push({ ...operation });
      return "QUEUED";
    }
    send(operation);
    return "SENT";
  }

  pendingCount(): number { return this.queue.length; }

  replay(send: (operation: OfflineOperation) => void): ReplayResult {
    if (!this.online) return { replayed: 0, remaining: this.queue.length };
    let replayed = 0;
    while (this.queue.length) {
      const operation = this.queue.shift()!;
      send(operation);
      replayed += 1;
    }
    return { replayed, remaining: 0 };
  }
}
