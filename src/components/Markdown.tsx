import React from 'react';

// Lightweight, dependency-free markdown renderer for LLM-generated reports.
// Handles: # / ## / ### headings, **bold**, *italic*, `code`, bullet + numbered
// lists, --- rules, and paragraphs. Good enough for the audit/report output.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold**, *italic*, and `code`, keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c-${i}`} style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.9em' }}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{part.slice(1, -1)}</em>);
    } else {
      nodes.push(<React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>);
    }
  });
  return nodes;
}

export const Markdown: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let ordered = false;

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const items = listItems;
    blocks.push(
      ordered
        ? <ol key={key} style={{ margin: '8px 0 12px 20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{items}</ol>
        : <ul key={key} style={{ margin: '8px 0 12px 20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{items}</ul>
    );
    listItems = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `md-${idx}`;

    if (!line.trim()) { flushList(key); return; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { flushList(key); blocks.push(<hr key={key} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />); return; }

    // Headings
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList(key);
      const level = h[1].length;
      const sizes = ['20px', '17px', '15px', '13px'];
      blocks.push(
        <div key={key} style={{ fontSize: sizes[level - 1], fontWeight: 700, color: '#fff', margin: level <= 2 ? '18px 0 8px' : '12px 0 6px' }}>
          {renderInline(h[2], key)}
        </div>
      );
      return;
    }

    // Bullet list
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (ordered) flushList(key);
      ordered = false;
      listItems.push(<li key={key}>{renderInline(bullet[1], key)}</li>);
      return;
    }

    // Numbered list
    const num = line.match(/^\s*\d+\.\s+(.*)$/);
    if (num) {
      if (!ordered) flushList(key);
      ordered = true;
      listItems.push(<li key={key}>{renderInline(num[1], key)}</li>);
      return;
    }

    // Paragraph
    flushList(key);
    blocks.push(<p key={key} style={{ margin: '6px 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{renderInline(line, key)}</p>);
  });
  flushList('md-end');

  return <div style={style}>{blocks}</div>;
};
