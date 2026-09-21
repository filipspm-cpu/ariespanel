import { type ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<strong key={`${keyPrefix}-${i++}`}>{match[1] || match[2]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  if (!nodes.length) return text;
  return nodes;
}

function isBullet(line: string) {
  return /^\s*[-*•]\s+/.test(line);
}

export function ForumMarkdown({ text }: { text: string }) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let block = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }

    if (isBullet(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i += 1;
      }
      const listId = block++;
      blocks.push(
        <ul key={`ul-${listId}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li-${listId}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBullet(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    const paraId = block++;
    blocks.push(<p key={`p-${paraId}`}>{renderInline(para.join("\n"), `p-${paraId}`)}</p>);
  }

  if (!blocks.length) return <p>Brak odpowiedzi asystenta.</p>;
  return <>{blocks}</>;
}
