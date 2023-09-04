import fs from 'fs';
import path from 'path';
import os from 'os';

import { FileMeta } from 'type_util/types';

export const META_PATH = path.join(os.homedir(), '.eidetic');
const DIR_LIST = path.join(META_PATH, 'directory_list.json');
const INDEX_PATH = path.join(META_PATH, 'index.json');

const EXT_WHITELIST = ['md', 'txt', 'json'];

type IndexItem = {
  pathCode: string;
  wordStart: number;
};

function objectToMap<K, V>(obj: any, map: Map<K, V>) {
  for (const key in obj) {
    map.set(key as K, obj[key] as V);
  }

  return map;
}

function extractWords(
  target: string,
  index: number,
  length: number,
  distance: number
) {
  let l = index,
    r = index + length - 1;

  return [
    Math.max(0, l - Math.round(distance / 2)),
    Math.min(r + Math.round(distance / 2), target.length - 1),
  ];
}

// vocabulary of words mapped to the files that contain them
export class Index {
  files: FileMeta[];

  constructor(files: FileMeta[]) {
    this.files = files;
  }

  lookup(query: string) {
    const filenames: FileMeta[] = [];
    query = query.toLowerCase();

    for (const file of this.files) {
      const contents = readFile(file.filepath)!.toLowerCase();
      const startIndex = contents.indexOf(query);

      if (startIndex === -1) {
        continue;
      }

      const indices = extractWords(contents, startIndex, query.length, 50);

      const context = contents.substring(indices[0], indices[1]);
      const keywordIndex = context.indexOf(query);

      if (keywordIndex === -1) {
        continue;
      }

      filenames.push({
        filepath: file.filepath,
        filename: path.basename(file.filepath),
        context,
        keywordIndex,
        keywordLength: query.length,
      } as FileMeta);
    }

    return filenames;
  }
}

export function getIndex() {
  const files = getAllFiles();
  const index = new Index(files);

  return index;
}

// get a list FileMeta[] of files in the given directory
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
    return [
      { filepath: `Error reading directory: ${error.message}`, filename: '' },
    ];
  }
}

export function createFileIfMissing(filepath: string) {
  if (!fs.existsSync(filepath)) {
    try {
      fs.writeFileSync(filepath, '[]');
      console.log(filepath + ' created successfully.');
    } catch (err) {
      console.error('Error creating file:', err);
    }
  } else {
    console.log(filepath + ' already exists.');
  }
}

export function createDirectoryIfMissing(directory: string) {
  if (!fs.existsSync(directory)) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      console.log(directory + ' created successfully.');
    } catch (err) {
      console.error('Error creating directory:', err);
    }
  } else {
    console.log(directory + ' already exists.');
  }
}

export function readFile(filepath: string) {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (err) {
    console.error('Error reading JSON file:', err);
  }
}

export function readBinaryFile(filepath: string) {
  try {
    return fs.readFileSync(filepath);
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

export function writeFile(filepath: string, contents: string) {
  try {
    fs.writeFileSync(filepath, contents); // Convert data to a formatted JSON string
    console.log(filepath + ' written to file successfully.');
  } catch (err) {
    console.error('Error writing to file:', err);
  }
}

export function getAllFiles() {
  const savedDirectories = readJSON(DIR_LIST) as string[];
  let fileList = [] as FileMeta[];
  for (const directory of savedDirectories) {
    fileList = fileList.concat(readDirectory(directory));
  }

  return fileList.filter((file) => file.filename && file.filepath);
}

// adds the directory to the saved list
// then returns an updated list of included files
export function addDirectory(dirPath: string) {
  createFileIfMissing(META_PATH);
  createFileIfMissing(DIR_LIST);

  const savedDirectories = readJSON(DIR_LIST) as string[];
  if (!savedDirectories.includes(dirPath)) {
    savedDirectories.push(dirPath);
    writeJSON(DIR_LIST, savedDirectories);
  }

  const fileList = getAllFiles();

  console.log('updated file list:', fileList);

  return fileList;
}
