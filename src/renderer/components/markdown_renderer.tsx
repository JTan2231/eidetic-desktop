import { marked } from 'marked';

import '../styles/directory.css';

export function MarkdownRenderer(props: { contents: string }) {
  return (
    <div
      className="markdownRenderer"
      dangerouslySetInnerHTML={{ __html: marked.parse(props.contents) }}
    ></div>
  );
}
