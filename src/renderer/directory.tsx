import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ipcRenderer } from 'electron';
import { useRef, RefObject, useEffect, useState } from 'react';
import { MarkdownRenderer } from './components/markdown_renderer';

import './styles/directory.css';

function Testing() {
  const directoryInput = useRef() as RefObject<HTMLInputElement>;
  const buttonClick = () => {
    const directory = directoryInput.current!.value;

    savedDirectories.push(directory);
    setSavedDirectories(savedDirectories);

    ipcRenderer.send('add-directory', directory);
  };

  const enterCheck = (e: any) => {
    if (e.keyCode === 13 || e.which === 13) {
      buttonClick();
      return;
    }
  };

  const [currentFiles, setCurrentFiles] = useState([] as any[]);
  const [savedDirectories, setSavedDirectories] = useState([] as string[]);
  const [currentView, setCurrentView] = useState('');

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

    ipcRenderer.send('get-all-files');
  }, []);

  const fileClick = (filepath: string) => {
    return () => {
      ipcRenderer.send('read-file', filepath);
    };
  };

  return (
    <div className="windowContainer">
      <div className="directory">
        <input
          ref={directoryInput}
          type="text"
          placeholder="Target directory"
          onKeyDown={enterCheck}
        />
        <button onClick={buttonClick}>Add directory</button>
        <div>
          Current Files:{' '}
          {currentFiles.map((f) => (
            <div className="fileItem" onClick={fileClick(f.filepath)}>
              {f.filename}
            </div>
          ))}
        </div>
      </div>
      <MarkdownRenderer contents={currentView} />
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
