import { marked } from 'marked';

import '../styles/directory.css';
import { FILE_TYPES, ViewMeta } from 'type_util/types';
import { useEffect, useState } from 'react';
import { ipcRenderer } from 'electron';

export function Renderer(props: { meta: ViewMeta }) {
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    ipcRenderer.on('get-pdf-contents-result', (_, contents) => {
      setHtmlContent(contents);
    });

    async function getContent() {
      switch (props.meta.fileType) {
        case FILE_TYPES.markdown:
          setHtmlContent(marked.parse(props.meta.content));
          break;

        case FILE_TYPES.pdf:
          console.error("pdfs aren't yet supported");
          break;

        case FILE_TYPES.html:
          setHtmlContent(props.meta.content);
          break;

        case FILE_TYPES.plaintext:
          setHtmlContent(props.meta.content);
          break;
      }
    }

    getContent();
  }, [props.meta.content]);

  return (
    <div className="markdownRenderer">
      <div
        className="rendererContent"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      ></div>
    </div>
  );
}
