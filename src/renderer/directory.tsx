import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ipcRenderer } from 'electron';
import { useRef, RefObject, useEffect, useState } from 'react';

import { Renderer } from './components/renderer';
import { FileMeta, ViewMeta } from 'type_util/types';

import './styles/directory.css';

function Testing() {
  const [currentFiles, setCurrentFilesUnwrapped] = useState([] as FileMeta[]);
  const [filteredFiles, setFilteredFiles] = useState([] as FileMeta[]);
  const [contentFilteredFiles, setContentFilteredFiles] = useState(
    [] as FileMeta[]
  );
  const [currentView, setCurrentView] = useState({} as ViewMeta);

  const sanitizeFileList = (files: any[]) => {
    return files.filter((f) => f.filename && f.filename.length > 0);
  };

  const setCurrentFiles = (files: string[]) => {
    setCurrentFilesUnwrapped(sanitizeFileList(files));
  };

  const contentFilteredCallback = (_: any, contents: FileMeta[]) => {
    setContentFilteredFiles(contents);
  };

  useEffect(() => {
    ipcRenderer.on('directory-contents', (_, contents) => {
      setCurrentFiles(contents);
    });

    ipcRenderer.on('updated-filelist', (_, contents) => {
      setCurrentFiles(contents);
    });

    ipcRenderer.on('receive-all-files', (_, contents) => {
      setCurrentFiles(contents);
    });

    ipcRenderer.on('read-file-return', (_, contents) => {
      setCurrentView(contents);
    });

    // assumes that filenames and filepaths come from the same place
    // (which they should)
    ipcRenderer.on('index-query-result', contentFilteredCallback);

    ipcRenderer.send('get-all-files');
  }, []);

  const fileClick = (filepath: string) => {
    return () => {
      ipcRenderer.send('read-file', filepath);
    };
  };

  const searchKeyDown = () => {
    const query = (document.getElementById('searchInput') as HTMLInputElement)!
      .value;

    let filteredFiles: FileMeta[] = [];
    if (query && query.length > 0) {
      filteredFiles = currentFiles.filter((f) => f.filename?.includes(query));
    }

    setFilteredFiles(filteredFiles);

    ipcRenderer.send('index-query', query);
  };

  const prepContext = (context: string, start: number, length: number) => {
    const end = start + length;

    return (
      <div className="fileItemContext">
        {context.substring(0, start)}
        <b className="fileItemKeyword">{context.substring(start, end)}</b>
        {context.substring(end, context.length)}
      </div>
    );
  };

  // this is wildly inefficient
  const mapFiles = (files: FileMeta[]) => {
    return files
      .filter(
        (value, index, array) =>
          array.map((f) => f.filename).indexOf(value.filename) === index
      )
      .map((f, index: number) => (
        <div
          key={`${index * 1}`}
          className="fileItem"
          onClick={fileClick(f.filepath)}
        >
          <div>{f.filename}</div>
          {f.context && f.keywordIndex !== undefined
            ? prepContext(f.context, f.keywordIndex, f.keywordLength!)
            : ''}
        </div>
      ));
  };

  const getSearchValue = () => {
    if (document.getElementById('searchInput') as HTMLInputElement) {
      return (document.getElementById('searchInput') as HTMLInputElement)
        ?.value;
    }

    return '';
  };

  return (
    <div className="windowContainer">
      <div className="directory">
        <button onClick={() => ipcRenderer.send('build-embeddings')}>
          Build embeddings
        </button>
        <input
          id="searchInput"
          type="text"
          placeholder="Search files"
          onKeyUp={searchKeyDown}
        />
        <div className="fileListContainer">
          {filteredFiles.length || getSearchValue().length ? (
            <>
              <b>Filename matches:</b>
              <div className="fileList">{mapFiles(filteredFiles)}</div>
              <div
                style={{
                  borderTop: '1px solid black',
                  height: '1px',
                  width: '100%',
                }}
              />
              <b>File content matches:</b>
              <div className="fileList">{mapFiles(contentFilteredFiles)}</div>
            </>
          ) : (
            mapFiles(currentFiles)
          )}
          <div>
            <button
              onClick={() => {
                ipcRenderer.send('open-directory-dialog');
              }}
            >
              Add directory
            </button>
          </div>
        </div>
      </div>
      <Renderer meta={currentView} />
    </div>
  );
}

export default function Directory() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Testing />} />
      </Routes>
    </Router>
  );
}
