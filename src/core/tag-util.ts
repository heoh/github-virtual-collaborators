import type { TagStore } from "./tag-store.js";

export function isAllowedVC(vcName: string, allowList?: Set<string>): boolean {
  if (!allowList) {
    return true;
  }
  return allowList.has(vcName);
}

export async function updateTagStoreByContent(
  tagStore: TagStore,
  issueNumber: number,
  title: string,
  body: string,
  isComment = false,
  allowList?: Set<string>,
): Promise<{ author: string | null; mentions: string[] }> {
  // Process Headers
  let author: string | null = null;
  const headerRegex = /^(?:\s*\n)?######\s+authored\s+by\s+@#([\w-]+)/i;
  const headerMatch = body.match(headerRegex);
  if (headerMatch && isAllowedVC(headerMatch[1], allowList)) {
    author = headerMatch[1];
    if (!isComment) {
      // For issue bodies, set the author tag based on the header.
      tagStore.removeTypes(issueNumber, ["author"]);
      tagStore.addTags(issueNumber, [
        `author:${author}`,
        `participant:${author}`,
      ]);
    }
  }

  // Process Commands
  const commandRegex = /^\/(\w+)(?:\s.*)?$/gm;
  let commandMatch;
  while ((commandMatch = commandRegex.exec(body)) !== null) {
    const command = commandMatch[1];
    const args = commandMatch[0].split(" ").slice(1);
    await processCommand(
      tagStore,
      issueNumber,
      command,
      args,
      author,
      allowList,
    );
  }

  // Process Mentions
  let mentions: string[] = [];
  const mentionRegex = /@#([\w-]+)/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(body)) !== null) {
    const mentionedName = mentionMatch[1];
    if (!isAllowedVC(mentionedName, allowList)) {
      continue;
    }
    tagStore.removeTags(issueNumber, [`unwatcher:${mentionedName}`]);
    tagStore.addTags(issueNumber, [`participant:${mentionedName}`]);
    mentions.push(mentionedName);
  }

  return { author, mentions };
}

async function processCommand(
  tagStore: TagStore,
  issueNumber: number,
  command: string,
  args: string[],
  author: string | null,
  allowList?: Set<string>,
): Promise<void> {
  if (command === "assign") {
    if (args.length === 1) {
      const mentionRegex = /^@#([\w-]+)$/;
      const assigneeMatch = args[0].match(mentionRegex);
      if (assigneeMatch) {
        const assignee = assigneeMatch[1];
        if (!isAllowedVC(assignee, allowList)) {
          return;
        }
        tagStore.removeTags(issueNumber, [`unwatcher:${assignee}`]);
        tagStore.removeTypes(issueNumber, ["assignee"]);
        tagStore.addTags(issueNumber, [
          `assignee:${assignee}`,
          `participant:${assignee}`,
        ]);
      }
    }
  } else if (command === "unassign") {
    tagStore.removeTypes(issueNumber, ["assignee"]);
  } else if (command === "watch") {
    if (author) {
      tagStore.removeTags(issueNumber, [`unwatcher:${author}`]);
      tagStore.addTags(issueNumber, [`watcher:${author}`]);
    }
  } else if (command === "unwatch") {
    if (author) {
      tagStore.removeTags(issueNumber, [`watcher:${author}`]);
      tagStore.addTags(issueNumber, [`unwatcher:${author}`]);
    }
  }
}

export function isNotifiableTags(tags: string[]): boolean {
  return !tags.includes("system:quiet");
}

export function getWatchingVCNames(tags: string[]): string[] {
  let watchers = new Set<string>();

  extractValuesByType(tags, "participant").forEach((vc) => watchers.add(vc));
  extractValuesByType(tags, "watcher").forEach((vc) => watchers.add(vc));
  extractValuesByType(tags, "unwatcher").forEach((vc) => watchers.delete(vc));

  return Array.from(watchers).sort();
}

export function extractValuesByType(tags: string[], type: string): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    if (tag.startsWith(`${type}:`)) {
      result.push(tag.substring(`${type}:`.length));
    }
  }
  return result;
}

export function extractValueByType(
  tags: string[],
  type: string,
): string | null {
  const result = extractValuesByType(tags, type);
  return result.length > 0 ? result[0] : null;
}
