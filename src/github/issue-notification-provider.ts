import type { VCName } from "../types.js";
import type {
  NotificationPayload,
  NotificationProvider,
} from "../core/notification-provider.js";
import type { TagStore } from "../core/tag-store.js";
import type { Octokit } from "./client.js";
import {
  findNotificationIssue,
  createNotificationIssue,
  createIssueComment,
} from "./client.js";

export interface IssuesNotificationProviderOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  tagStore: TagStore;
}

export class IssueNotificationProvider implements NotificationProvider {
  private readonly opts: IssuesNotificationProviderOptions;
  private readonly issueCache = new Map<VCName, number>();

  constructor(opts: IssuesNotificationProviderOptions) {
    this.opts = opts;
  }

  private notificationIssueTitle(vcName: VCName): string {
    return `[VC:notifications] @#${vcName}`;
  }

  private async findOrCreateNotificationIssue(vcName: VCName): Promise<number> {
    const cached = this.issueCache.get(vcName);
    if (cached !== undefined) return cached;

    const { octokit, owner, repo } = this.opts;
    const title = this.notificationIssueTitle(vcName);

    let issueNumber = await findNotificationIssue(octokit, owner, repo, title);
    if (issueNumber === null) {
      issueNumber = await createNotificationIssue(
        octokit,
        owner,
        repo,
        title,
        vcName,
      );

      // Mark newly created Notification Issues with a system tag so the action skips
      // re-processing them and avoids infinite notification loops.
      await this.opts.tagStore.addTags(issueNumber, ["system:quiet"]).commit();
    }

    this.issueCache.set(vcName, issueNumber);
    return issueNumber;
  }

  /**
   * Sends `notification` to the `to` VC.
   * Finds or creates the VC's dedicated Notification Issue, then adds a comment.
   */
  async notify(to: VCName, payload: NotificationPayload): Promise<void> {
    const { octokit, owner, repo } = this.opts;
    const issueNumber = await this.findOrCreateNotificationIssue(to);
    const body = this.buildNotificationBody(payload);
    await createIssueComment(octokit, owner, repo, issueNumber, body);
  }

  private buildNotificationBody(payload: NotificationPayload): string {
    let body = "";
    for (const [key, value] of Object.entries(payload)) {
      body += `* **${key}**: ${value}\n`;
    }
    return body;
  }
}
