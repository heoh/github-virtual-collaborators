import { getContext, getInputs, getOctokit } from "../context.js";
import type { TagStore } from "../core/tag-store.js";
import { ProjectMetadataStore } from "../github/project-metadata-store.js";
import { IssueNotificationProvider } from "../github/issue-notification-provider.js";

export function getTagStore() {
  const ctx = getContext();
  const inputs = getInputs();
  const octokit = getOctokit();
  return new ProjectMetadataStore({
    octokit,
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    projectOwner: inputs.projectOwner,
    projectNumber: inputs.projectNumber,
    tagsFieldName: inputs.tagsFieldName,
  });
}

export function getNotifier(tagStore: TagStore) {
  const ctx = getContext();
  const inputs = getInputs();
  const octokit = getOctokit();
  return new IssueNotificationProvider({
    octokit,
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    tagStore,
  });
}
