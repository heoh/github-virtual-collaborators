import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

type Range = { start: number; end: number };

export function maskNonActionableMarkdown(input: string): string {
  if (!input) {
    return input;
  }

  const ranges: Range[] = [];

  try {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(input);

    visit(tree, (node) => {
      if (node.type !== "code" && node.type !== "inlineCode") {
        return;
      }

      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        start < 0 ||
        end <= start ||
        end > input.length
      ) {
        return;
      }

      ranges.push({ start, end });
    });
  } catch {
    // Keep behavior safe even on unexpected parser failures.
    // We still continue with line-based blockquote masking below.
  }

  const blockquoteLineRegex = /^\s*>.*$/gm;
  let blockquoteLineMatch: RegExpExecArray | null;
  while ((blockquoteLineMatch = blockquoteLineRegex.exec(input)) !== null) {
    ranges.push({
      start: blockquoteLineMatch.index,
      end: blockquoteLineMatch.index + blockquoteLineMatch[0].length,
    });
  }

  if (ranges.length === 0) {
    return input;
  }

  const merged = mergeRanges(ranges);
  const chars = Array.from(input);

  for (const { start, end } of merged) {
    for (let i = start; i < end; i++) {
      if (chars[i] !== "\n" && chars[i] !== "\r") {
        chars[i] = " ";
      }
    }
  }

  return chars.join("");
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Range[] = [];

  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (!last || current.start > last.end) {
      merged.push({ ...current });
      continue;
    }
    if (current.end > last.end) {
      last.end = current.end;
    }
  }

  return merged;
}
