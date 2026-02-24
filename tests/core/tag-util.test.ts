import type { TagStore } from "../../src/core/tag-store.js";
import { updateTagStoreByContent } from "../../src/core/tag-util.js";

class InMemoryTagStore implements TagStore {
  private tagsByIssue = new Map<number, Set<string>>();

  setTags(issueNumber: number, tags: string[]): TagStore {
    this.tagsByIssue.set(issueNumber, new Set(tags));
    return this;
  }

  addTags(issueNumber: number, tags: string[]): TagStore {
    const set = this.ensure(issueNumber);
    tags.forEach((tag) => set.add(tag));
    return this;
  }

  removeTags(issueNumber: number, tags: string[]): TagStore {
    const set = this.ensure(issueNumber);
    tags.forEach((tag) => set.delete(tag));
    return this;
  }

  removeTypes(issueNumber: number, types: string[]): TagStore {
    const set = this.ensure(issueNumber);
    for (const type of types) {
      for (const tag of Array.from(set)) {
        if (tag.startsWith(`${type}:`)) {
          set.delete(tag);
        }
      }
    }
    return this;
  }

  async getTags(issueNumber: number): Promise<string[]> {
    return Array.from(this.ensure(issueNumber)).sort();
  }

  async commit(): Promise<void> {
    return;
  }

  private ensure(issueNumber: number): Set<string> {
    if (!this.tagsByIssue.has(issueNumber)) {
      this.tagsByIssue.set(issueNumber, new Set());
    }
    return this.tagsByIssue.get(issueNumber)!;
  }
}

describe("updateTagStoreByContent allow-list", () => {
  test("filters header and mentions by allow-list", async () => {
    const tagStore = new InMemoryTagStore();
    const allowList = new Set(["alice", "bob"]);

    const result = await updateTagStoreByContent(
      tagStore,
      1,
      "",
      [
        "###### authored by @#carol\n",
        "\n",
        "hello @#alice and @#carol\n",
      ].join(),
      false,
      allowList,
    );

    const tags = await tagStore.getTags(1);

    expect(result.author).toBeNull();
    expect(result.mentions).toEqual(["alice"]);
    expect(tags).toContain("participant:alice");
    expect(tags).not.toContain("participant:carol");
    expect(tags).not.toContain("author:carol");
  });

  test("ignores disallowed assignee in /assign command", async () => {
    const tagStore = new InMemoryTagStore();
    tagStore.addTags(2, ["assignee:alice", "participant:alice"]);
    const allowList = new Set(["alice", "bob"]);

    await updateTagStoreByContent(
      tagStore,
      2,
      "",
      "/assign @#carol",
      false,
      allowList,
    );

    const tags = await tagStore.getTags(2);
    expect(tags).toContain("assignee:alice");
    expect(tags).not.toContain("assignee:carol");
  });

  test("keeps backward compatibility when allow-list is not provided", async () => {
    const tagStore = new InMemoryTagStore();

    const result = await updateTagStoreByContent(
      tagStore,
      3,
      "",
      "###### authored by @#carol\n\n/assign @#dave\n\nhello @#erin",
    );

    const tags = await tagStore.getTags(3);

    expect(result.author).toBe("carol");
    expect(result.mentions).toEqual(
      expect.arrayContaining(["carol", "dave", "erin"]),
    );
    expect(tags).toEqual(
      expect.arrayContaining([
        "author:carol",
        "participant:carol",
        "participant:dave",
        "participant:erin",
        "assignee:dave",
      ]),
    );
  });
});
