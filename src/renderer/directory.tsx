import { MemoryRouter as Router, Routes, Route } from "react-router-dom";
import { ipcRenderer } from "electron";
import { useRef, RefObject, useEffect, useState } from "react";

import { MarkdownRenderer } from "./components/markdown_renderer";
import { FileMeta } from "type_util/types";

import "./styles/directory.css";

function Testing() {
  const directoryInput = useRef() as RefObject<HTMLInputElement>;
  const buttonClick = () => {
    const directory = directoryInput.current!.value;

    savedDirectories.push(directory);
    setSavedDirectories(savedDirectories);

    ipcRenderer.send("add-directory", directory);
  };

  const enterCheck = (e: any) => {
    if (e.keyCode === 13 || e.which === 13) {
      buttonClick();
    }
  };

  const [currentFiles, setCurrentFilesUnwrapped] = useState([] as FileMeta[]);
  const [filteredFiles, setFilteredFiles] = useState([] as FileMeta[]);
  const [contentFilteredFiles, setContentFilteredFiles] = useState(
    [] as FileMeta[]
  );
  const [savedDirectories, setSavedDirectories] = useState([] as string[]);
  const [currentView, setCurrentView] = useState("");

  const sanitizeFileList = (files: any[]) => {
    return files.filter((f) => f.filename && f.filename.length > 0);
  };

  const setCurrentFiles = (files: string[]) => {
    setCurrentFilesUnwrapped(sanitizeFileList(files));
  };

  const contentFilteredCallback = (_: any, contents: any[]) => {
    console.log(currentFiles, contents);
    setContentFilteredFiles(contents);
  };

  useEffect(() => {
    ipcRenderer.on("directory-contents", (_, contents) => {
      setCurrentFiles(contents);
    });

    ipcRenderer.on("updated-filelist", (_, contents) => {
      setCurrentFiles(contents);
    });

    ipcRenderer.on("receive-all-files", (_, contents) => {
      setCurrentFiles(contents);
    });

    ipcRenderer.on("read-file-return", (_, contents) => {
      setCurrentView(contents);
    });

    // assumes that filenames and filepaths come from the same place
    // (which they should)
    ipcRenderer.on("index-query-result", contentFilteredCallback);

    ipcRenderer.send("get-all-files");
  }, []);

  const fileClick = (filepath: string) => {
    return () => {
      ipcRenderer.send("read-file", filepath);
    };
  };

  const searchKeyDown = () => {
    const query = (document.getElementById("searchInput") as HTMLInputElement)!
      .value;

    let filteredFiles: FileMeta[] = [];
    if (query && query.length > 0) {
      filteredFiles = currentFiles.filter((f) => f.filename?.includes(query));
    }

    setFilteredFiles(filteredFiles);

    ipcRenderer.send("index-query", query);
  };

  // this is wildly inefficient
  const mapFiles = (files: any[]) => {
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
          {f.filename}
        </div>
      ));
  };

  const getSearchValue = () => {
    if (document.getElementById("searchInput") as HTMLInputElement) {
      return (document.getElementById("searchInput") as HTMLInputElement)
        ?.value;
    }

    return "";
  };

  return (
    <div className="windowContainer">
      <div className="directory">
        <div>
          <input
            ref={directoryInput}
            type="text"
            placeholder="Target directory"
            onKeyDown={enterCheck}
          />
          <button onClick={buttonClick}>Add directory</button>
        </div>
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
                  borderTop: "1px solid black",
                  height: "1px",
                  width: "100%"
                }}
              />
              <b>File content matches:</b>
              <div className="fileList">{mapFiles(contentFilteredFiles)}</div>
            </>
          ) : (
            mapFiles(currentFiles)
          )}
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
