import fs from 'fs';
import path from 'path';
import os from 'os';

const META_PATH = path.join(os.homedir(), '.eidetic');
const DIR_LIST = path.join(META_PATH, 'directory_list.json');

const EXT_WHITELIST = ['md', 'txt'];

export function readDirectory(dirPath: string) {
  try {
    const contents = fs.readdirSync(dirPath);
    const items = contents
      .filter((item) => {
        const split = item.split('.');
        return split.length > 1 && EXT_WHITELIST.includes(split[1]);
      })
      .map((item) => ({
        filepath: path.join(dirPath, item),
        filename: item,
      }));
    return items;
  } catch (error: any) {
    return [`Error reading directory: ${error.message}`];
  }
}

function createMetaPath() {
  if (!fs.existsSync(META_PATH)) {
    try {
      fs.mkdirSync(META_PATH);
      console.log(META_PATH + ' created successfully.');
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  } else {
    console.log('Folder already exists.');
  }
}

function createDirList() {
  if (!fs.existsSync(DIR_LIST)) {
    try {
      fs.writeFileSync(DIR_LIST, '[]');
      console.log(DIR_LIST + ' created successfully.');
    } catch (err) {
      console.error('Error creating file:', err);
    }
  } else {
    console.log(DIR_LIST + ' already exists.');
  }
}

export function readFile(filepath: string) {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (err) {
    console.error('Error reading JSON file:', err);
  }
}

function readJSON(filepath: string) {
  try {
    const content = readFile(filepath)!;
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading JSON file:', err);
  }
}

function writeJSON(filepath: string, data: string[]) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8'); // Convert data to a formatted JSON string
    console.log(filepath + ' written to file successfully.');
  } catch (err) {
    console.error('Error writing to file:', err);
  }
}

export function getAllFiles() {
  const savedDirectories = readJSON(DIR_LIST) as string[];
  let fileList = [] as any[];
  for (const directory of savedDirectories) {
    fileList = fileList.concat(readDirectory(directory));
  }

  return fileList;
}

// adds the directory to the saved list
// then returns an updated list of included files
export function addDirectory(dirPath: string) {
  createMetaPath();
  createDirList();

  const savedDirectories = readJSON(DIR_LIST) as string[];
  if (!savedDirectories.includes(dirPath)) {
    savedDirectories.push(dirPath);
    writeJSON(DIR_LIST, savedDirectories);
  }

  const fileList = getAllFiles();

  console.log('updated file list:', fileList);

  return fileList;
}
