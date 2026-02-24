import type { VCName } from "../types.js";

export type NotificationPayload = Record<string, unknown>;

export interface NotificationProvider {
  notify(to: VCName, payload: NotificationPayload): Promise<void>;
}
