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

export async function handleIssueComment(): Promise<void> {
  const ctx = getContext();
  const inputs = getInputs();

  const { action, issue, comment } = ctx.payload;
  if (!action) {
    core.warning("issue_comment: missing action");
    return;
  }
  if (!issue) {
    core.warning("issue_comment: missing issue");
    return;
  }
  if (!comment) {
    core.warning("issue_comment: missing comment");
    return;
  }

  core.info(
    `handleIssueComment: action=${action}, issue=#${issue.number}, comment=${comment.id}`,
  );

  const tagStore = getTagStore();

  let author: string | null = null;
  let mentions: string[] = [];
  if (action === "created" || action === "edited") {
    const result = await updateTagStoreByContent(
      tagStore,
      issue.number,
      "",
      comment.body ?? "",
      true,
      inputs.virtualCollaborators,
    );
    author = result.author;
    mentions = result.mentions;
    await tagStore.commit();
  }

  const tags = await tagStore.getTags(issue.number);
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
      payload["event"] = `\`comment_${action}\``;
      payload["issue"] = `\`#${issue.number}\`  ${issue.title}`;
      payload["comment_id"] = comment.id;
      if (mentions.includes(watcher)) payload["mention"] = true;
      if (watcher === assignee) payload["assignee"] = true;
      await notifier.notify(watcher, payload);
    }
  }
}
