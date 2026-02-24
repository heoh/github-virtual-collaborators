import type { TagStore } from "../core/tag-store.js";
import type { Octokit } from "./client.js";
import {
  getProjectInfo,
  getOrCreateProjectItem,
  getProjectItemTextFieldByName,
  updateTextField,
  getIssueNodeId,
  getPRNodeId,
} from "./client.js";

export interface ProjectMetadataStoreOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  projectOwner: string;
  projectNumber: number;
  tagsFieldName: string;
}

type Command =
  | { type: "setTags"; issueNumber: number; tags: string[] }
  | { type: "addTags"; issueNumber: number; tags: string[] }
  | { type: "removeTags"; issueNumber: number; tags: string[] }
  | { type: "removeTypes"; issueNumber: number; types: string[] };

/**
 * Reads and writes Issue/PR metadata(tags) via GitHub Projects v2.
 */
export class ProjectMetadataStore implements TagStore {
  private readonly opts: ProjectMetadataStoreOptions;
  private projectId?: string;
  private fieldId?: string;
  private commands: Command[];

  constructor(opts: ProjectMetadataStoreOptions) {
    this.opts = opts;
    this.commands = [];
  }

  setTags(issueNumber: number, tags: string[]): ProjectMetadataStore {
    const command: Command = { type: "setTags", issueNumber, tags };
    this.commands.push(command);
    return this;
  }

  addTags(issueNumber: number, tags: string[]): ProjectMetadataStore {
    const command: Command = { type: "addTags", issueNumber, tags };
    this.commands.push(command);
    return this;
  }

  removeTags(issueNumber: number, tags: string[]): ProjectMetadataStore {
    const command: Command = { type: "removeTags", issueNumber, tags };
    this.commands.push(command);
    return this;
  }

  removeTypes(issueNumber: number, types: string[]): ProjectMetadataStore {
    const command: Command = { type: "removeTypes", issueNumber, types };
    this.commands.push(command);
    return this;
  }

  async getTags(issueNumber: number): Promise<string[]> {
    const { tagsRaw } = await this.getOrCreateItem(issueNumber);
    let tags = new Set(this.parseTags(tagsRaw));
    for (const command of this.commands) {
      if (command.issueNumber !== issueNumber) {
        continue;
      }
      if (command.type === "setTags") {
        tags = new Set(command.tags);
      } else if (command.type === "addTags") {
        command.tags.forEach((tag) => tags.add(tag));
      } else if (command.type === "removeTags") {
        command.tags.forEach((tag) => tags.delete(tag));
      } else if (command.type === "removeTypes") {
        command.types.forEach((type) => {
          for (const tag of tags) {
            if (tag.startsWith(`${type}:`)) {
              tags.delete(tag);
            }
          }
        });
      }
    }
    return Array.from(tags).sort();
  }

  async commit(): Promise<void> {
    const { projectId, fieldId } = await this.ensureProject();
    const issueMap: Record<number, { itemId: string; tags: Set<string> }> = {};
    for (const command of this.commands) {
      if (!issueMap[command.issueNumber]) {
        const contentNodeId = await this.getContentNodeId(command.issueNumber);
        const { itemId, tagsRaw } = await this.ensureItem(
          projectId,
          contentNodeId,
        );
        issueMap[command.issueNumber] = {
          itemId,
          tags: new Set(this.parseTags(tagsRaw)),
        };
      }
      const { itemId, tags } = issueMap[command.issueNumber];
      if (command.type === "setTags") {
        issueMap[command.issueNumber].tags = new Set(command.tags);
      } else if (command.type === "addTags") {
        command.tags.forEach((tag) => tags.add(tag));
      } else if (command.type === "removeTags") {
        command.tags.forEach((tag) => tags.delete(tag));
      } else if (command.type === "removeTypes") {
        command.types.forEach((type) => {
          for (const tag of tags) {
            if (tag.startsWith(`${type}:`)) {
              tags.delete(tag);
            }
          }
        });
      }
    }
    for (const issueNumber in issueMap) {
      const { itemId, tags } = issueMap[issueNumber];
      const rawTags = " " + Array.from(tags).sort().join(" ") + " ";
      await updateTextField(
        this.opts.octokit,
        projectId,
        itemId,
        fieldId,
        rawTags,
      );
    }
    this.commands = [];
  }

  private async getOrCreateItem(
    issueNumber: number,
  ): Promise<{ itemId: string; tagsRaw: string }> {
    const { projectId } = await this.ensureProject();
    const contentNodeId = await this.getContentNodeId(issueNumber);
    return this.ensureItem(projectId, contentNodeId);
  }

  private async ensureProject(): Promise<{
    projectId: string;
    fieldId: string;
  }> {
    if (!this.projectId || !this.fieldId) {
      const info = await getProjectInfo(
        this.opts.octokit,
        this.opts.projectOwner,
        this.opts.projectNumber,
        this.opts.tagsFieldName,
      );
      this.projectId = info.projectId;
      this.fieldId = info.fieldId;
    }
    return { projectId: this.projectId, fieldId: this.fieldId };
  }

  private async getContentNodeId(issueNumber: number): Promise<string> {
    const { octokit, owner, repo } = this.opts;
    return (
      (await getIssueNodeId(octokit, owner, repo, issueNumber)) ??
      (await getPRNodeId(octokit, owner, repo, issueNumber))
    );
  }

  private async ensureItem(
    projectId: string,
    contentNodeId: string,
  ): Promise<{ itemId: string; tagsRaw: string }> {
    const itemId = await getOrCreateProjectItem(
      this.opts.octokit,
      projectId,
      contentNodeId,
    );
    const tagsRaw = await getProjectItemTextFieldByName(
      this.opts.octokit,
      itemId,
      this.opts.tagsFieldName,
    );
    return { itemId, tagsRaw };
  }

  private parseTags(raw: string): string[] {
    if (!raw) {
      return [];
    }
    return raw.trim().split(" ");
  }
}
