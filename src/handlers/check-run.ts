import * as core from "@actions/core";
import { getContext, getInputs, getOctokit } from "../context.js";
import { getPRNumberForCheckRun } from "../github/client.js";
import { getNotifier, getTagStore } from "./shared.js";
import {
  extractValueByType,
  getWatchingVCNames,
  isAllowedVC,
  isNotifiableTags,
} from "../core/tag-util.js";
import type { NotificationPayload } from "../core/notification-provider.js";

export async function handleCheckRun(): Promise<void> {
  const ctx = getContext();
  const inputs = getInputs();
  const octokit = getOctokit();

  const { action, check_run: checkRun } = ctx.payload;
  if (!action) {
    core.warning("check_run: missing action");
    return;
  }
  if (!checkRun) {
    core.warning("check_run: missing check_run");
    return;
  }

  if (action !== "completed") {
    core.info(`handleCheckRun: action=${action} is not actionable, skipping`);
    return;
  }

  const conclusion = checkRun.conclusion ?? "";
  if (conclusion !== "failure" && conclusion !== "action_required") {
    core.info(
      `handleCheckRun: conclusion=${conclusion} is not actionable, skipping`,
    );
    return;
  }

  const { owner, repo } = ctx.repo;
  const headSha = checkRun.head_sha;
  const prNumber = await getPRNumberForCheckRun(octokit, owner, repo, headSha);

  if (prNumber === null) {
    core.info(`handleCheckRun: no PR associated with sha ${headSha}, skipping`);
    return;
  }

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  core.info(
    `handleCheckRun: action=${action}, conclusion=${conclusion}, pr=#${pr.number}`,
  );

  const tagStore = getTagStore();
  const tags = await tagStore.getTags(pr.number);
  if (!isNotifiableTags(tags)) {
    return;
  }

  const assignee = extractValueByType(tags, "assignee");
  const watchers = getWatchingVCNames(tags).filter((vc) =>
    isAllowedVC(vc, inputs.virtualCollaborators),
  );
  if (watchers.length === 0) {
    core.info("handleCheckRun: no watchers, skipping notification");
    return;
  }

  const notifier = getNotifier(tagStore);
  for (const watcher of watchers) {
    const payload: NotificationPayload = {};
    payload["event"] =
      conclusion === "failure" ? "`check_failed`" : "`check_action_required`";
    payload["pr"] = `\`#${pr.number}\`  ${pr.title}`;
    payload["check"] = checkRun.name;
    if (checkRun.details_url) payload["details_url"] = checkRun.details_url;
    if (watcher === assignee) payload["assignee"] = true;
    await notifier.notify(watcher, payload);
  }
}
