import type { TagStore } from "../core/tag-store.js";
import type { Octokit } from "./client.js";

export interface LabelMetadataStoreOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  labelPrefix?: string;
  labelDefaultColor?: string;
}

type Command =
  | { type: "setTags"; issueNumber: number; tags: string[] }
  | { type: "addTags"; issueNumber: number; tags: string[] }
  | { type: "removeTags"; issueNumber: number; tags: string[] }
  | { type: "removeTypes"; issueNumber: number; types: string[] };

export class LabelMetadataStore implements TagStore {
  private readonly opts: LabelMetadataStoreOptions;
  private readonly commands: Command[] = [];

  constructor(opts: LabelMetadataStoreOptions) {
    this.opts = opts;
  }

  setTags(issueNumber: number, tags: string[]): LabelMetadataStore {
    this.commands.push({ type: "setTags", issueNumber, tags });
    return this;
  }

  addTags(issueNumber: number, tags: string[]): LabelMetadataStore {
    this.commands.push({ type: "addTags", issueNumber, tags });
    return this;
  }

  removeTags(issueNumber: number, tags: string[]): LabelMetadataStore {
    this.commands.push({ type: "removeTags", issueNumber, tags });
    return this;
  }

  removeTypes(issueNumber: number, types: string[]): LabelMetadataStore {
    this.commands.push({ type: "removeTypes", issueNumber, types });
    return this;
  }

  async getTags(issueNumber: number): Promise<string[]> {
    let tags = new Set(await this.getCurrentTags(issueNumber));
    for (const command of this.commands) {
      if (command.issueNumber !== issueNumber) continue;
      tags = this.applyCommand(tags, command);
    }
    return Array.from(tags).sort();
  }

  async commit(): Promise<void> {
    const issueNumbers = Array.from(
      new Set(this.commands.map((c) => c.issueNumber)),
    );

    for (const issueNumber of issueNumbers) {
      const originalTags = new Set(await this.getCurrentTags(issueNumber));
      let nextTags = new Set(originalTags);

      for (const command of this.commands) {
        if (command.issueNumber !== issueNumber) continue;
        nextTags = this.applyCommand(nextTags, command);
      }

      const toAdd = Array.from(nextTags).filter(
        (tag) => !originalTags.has(tag),
      );
      const toRemove = Array.from(originalTags).filter(
        (tag) => !nextTags.has(tag),
      );

      await this.removeLabels(issueNumber, toRemove);
      await this.addLabels(issueNumber, toAdd);
    }

    this.commands.length = 0;
  }

  private applyCommand(tags: Set<string>, command: Command): Set<string> {
    const next = new Set(tags);
    if (command.type === "setTags") {
      return new Set(command.tags);
    }

    if (command.type === "addTags") {
      command.tags.forEach((tag) => next.add(tag));
      return next;
    }

    if (command.type === "removeTags") {
      command.tags.forEach((tag) => next.delete(tag));
      return next;
    }

    for (const type of command.types) {
      for (const tag of next) {
        if (tag.startsWith(`${type}:`)) {
          next.delete(tag);
        }
      }
    }
    return next;
  }

  private get prefix(): string {
    return this.opts.labelPrefix ?? "vc:";
  }

  private get defaultColor(): string {
    return this.opts.labelDefaultColor ?? "8a8a8a";
  }

  private toLabel(tag: string): string {
    return `${this.prefix}${tag}`;
  }

  private fromLabel(label: string): string | null {
    if (!label.startsWith(this.prefix)) return null;
    return label.slice(this.prefix.length);
  }

  private async getCurrentTags(issueNumber: number): Promise<string[]> {
    const labels = await this.opts.octokit.paginate(
      this.opts.octokit.rest.issues.listLabelsOnIssue,
      {
        owner: this.opts.owner,
        repo: this.opts.repo,
        issue_number: issueNumber,
        per_page: 100,
      },
    );

    const tags: string[] = [];
    for (const label of labels) {
      if (!label.name) continue;
      const tag = this.fromLabel(label.name);
      if (tag) tags.push(tag);
    }
    return tags;
  }

  private async addLabels(issueNumber: number, tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    for (const tag of tags) {
      await this.ensureLabelExists(this.toLabel(tag));
    }

    await this.opts.octokit.rest.issues.addLabels({
      owner: this.opts.owner,
      repo: this.opts.repo,
      issue_number: issueNumber,
      labels: tags.map((tag) => this.toLabel(tag)),
    });
  }

  private async removeLabels(
    issueNumber: number,
    tags: string[],
  ): Promise<void> {
    for (const tag of tags) {
      try {
        await this.opts.octokit.rest.issues.removeLabel({
          owner: this.opts.owner,
          repo: this.opts.repo,
          issue_number: issueNumber,
          name: this.toLabel(tag),
        });
      } catch (error: unknown) {
        const status = (error as { status?: number }).status;
        if (status !== 404) {
          throw error;
        }
      }
    }
  }

  private async ensureLabelExists(labelName: string): Promise<void> {
    try {
      await this.opts.octokit.rest.issues.getLabel({
        owner: this.opts.owner,
        repo: this.opts.repo,
        name: labelName,
      });
      return;
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      if (status !== 404) {
        throw error;
      }
    }

    await this.opts.octokit.rest.issues.createLabel({
      owner: this.opts.owner,
      repo: this.opts.repo,
      name: labelName,
      color: this.defaultColor,
    });
  }
}
