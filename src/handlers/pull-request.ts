import * as core from "@actions/core";
import {
  isNotifiableTags,
  updateTagStoreByContent,
  getWatchingVCNames,
  extractValueByType,
  isAllowedVC,
} from "../core/tag-util.js";
import { getContext, getInputs } from "../context.js";
import { getTagStore, getNotifier } from "./shared.js";
import type { NotificationPayload } from "../core/notification-provider.js";

export async function handlePullRequest(): Promise<void> {
  const ctx = getContext();
  const inputs = getInputs();

  const { action, pull_request: pr } = ctx.payload;
  if (!action) {
    core.warning("pull_request: missing action");
    return;
  }
  if (!pr) {
    core.warning("pull_request: missing pull_request");
    return;
  }

  core.info(`handlePullRequest: action=${action}, pr=#${pr.number}`);

  const tagStore = getTagStore();

  let author: string | null = null;
  let mentions: string[] = [];
  if (action === "opened" || action === "edited") {
    const result = await updateTagStoreByContent(
      tagStore,
      pr.number,
      pr.title,
      pr.body ?? "",
      false,
      inputs.virtualCollaborators,
    );
    author = result.author;
    mentions = result.mentions;
    await tagStore.commit();
  }

  const tags = await tagStore.getTags(pr.number);
  if (isNotifiableTags(tags)) {
    const assignee = extractValueByType(tags, "assignee");
    const watchers = getWatchingVCNames(tags).filter((vc) =>
      isAllowedVC(vc, inputs.virtualCollaborators),
    );
    const notifier = getNotifier(tagStore);
    for (const watcher of watchers) {
      // Skip notifying the authoring user to avoid redundant notifications.
      if (watcher === author) {
        continue;
      }

      const payload: NotificationPayload = {};
      payload["event"] = `\`pr_${action}\``;
      payload["issue"] = `\`#${pr.number}\`  ${pr.title}`;
      if (action === "closed" && pr.merged) {
        payload["event"] = "`pr_merged`";
      }
      if (mentions.includes(watcher)) payload["mention"] = true;
      if (watcher === assignee) payload["assignee"] = true;
      await notifier.notify(watcher, payload);
    }
  }
}
