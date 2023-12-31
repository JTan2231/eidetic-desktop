/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import * as fs from 'fs';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  addDirectory,
  getAllFiles,
  readDirectory,
  readFile,
  getIndex,
  readBinaryFile,
} from './serialization';
import { FILE_TYPES, ViewMeta } from '../type_util/types';
import { EmbeddingIndex } from './embedding_index';

const PDFJS = require('pdfjs-dist');

PDFJS.GlobalWorkerOptions.workerSrc =
  require('pdfjs-dist/build/pdf.worker').url;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

const index = getIndex();
const embeddingIndex = new EmbeddingIndex(null, []);
embeddingIndex.load(getAllFiles());

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.on('read-directory', (event, directory) => {
  const contents = readDirectory(directory);
  event.reply('directory-contents', contents);
});

ipcMain.on('add-directory', (event, directory) => {
  const updatedFileList = addDirectory(directory);
  event.reply('updated-filelist', updatedFileList);
});

ipcMain.on('get-all-files', (event) => {
  event.reply('receive-all-files', getAllFiles());
});

ipcMain.on('read-file', (event, filepath) => {
  const meta = {} as any;
  meta.fileType = path.basename(filepath).split('.').pop();

  if (meta.fileType === FILE_TYPES.pdf) {
    meta.content = filepath;
  } else {
    meta.content = readFile(filepath);
  }

  event.reply('read-file-return', meta as ViewMeta);
});

ipcMain.on('index-query', (event, query: string) => {
  event.reply('index-query-result', index.lookup(query));
});

ipcMain.on('get-pdf-contents', (event, filepath: string) => {
  const contents = readBinaryFile(filepath)!;
  const buffer = new Uint8Array(contents).buffer;

  PDFJS.getDocument(buffer).promise.then((doc: any) => {
    console.log(doc);
    event.reply('get-pdf-contents-result', doc);
  });
});

ipcMain.on('build-embeddings', (event) => {
  embeddingIndex.build(getAllFiles().map((f) => f.filepath));
});

ipcMain.on('search-embeddings', async (event, query: string) => {
  const rankings = await embeddingIndex.rank(query);

  event.reply('search-embeddings-result', rankings);
});

ipcMain.on('open-directory-dialog', (event) => {
  dialog
    .showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    })
    .then((res) => {
      if (!res.canceled) {
        const directory = res.filePaths[0];
        const updatedFileList = addDirectory(directory);
        event.reply('updated-filelist', updatedFileList);
      }
    });
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
