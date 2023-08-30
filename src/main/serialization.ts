import fs from "fs";
import path from "path";
import os from "os";

import { FileMeta } from "type_util/types";

const META_PATH = path.join(os.homedir(), ".eidetic");
const DIR_LIST = path.join(META_PATH, "directory_list.json");
const INDEX_PATH = path.join(META_PATH, "index.json");

const EXT_WHITELIST = ["md", "txt"];

type IndexItem = {
  pathCode: number;
  wordStart: number;
};

// vocabulary of words mapped to the files that contain them
export class Index {
  wordMap: Map<string, IndexItem[]>;

  // this is to cut down on file size in the index
  pathEncoder: Map<string, number>;
  pathDecoder: Map<number, string>;

  constructor(
    map: Map<string, IndexItem[]>,
    pathEncoder: Map<string, number>,
    pathDecoder: Map<number, string>
  ) {
    this.wordMap = map;
    this.pathEncoder = pathEncoder;
    this.pathDecoder = pathDecoder;
  }

  lookup(query: string) {
    const filenames: FileMeta[] = []; // set of strings of FileMeta ????
    this.wordMap.forEach((value: IndexItem[], key: string) => {
      if (key.includes(query)) {
        for (const fileIndex of value) {
          const filepath = this.pathDecoder.get(fileIndex.pathCode)!;
          filenames.push({
            filepath: filepath,
            filename: filepath.split("\\").pop()!.split("/").pop()
          } as FileMeta);
        }
      }
    });

    return filenames;
  }

  static build(filepaths: string[]) {
    const map = new Map<string, IndexItem[]>();
    const pathEncoder = new Map<string, number>();
    const pathDecoder = new Map<number, string>();

    const addToMaps = (path: string) => {
      if (!pathEncoder.has(path)) {
        pathEncoder.set(path, pathEncoder.size);
        pathDecoder.set(pathEncoder.get(path)!, path);
      }
    };

    const getPathCode = (path: string) => {
      if (pathEncoder.has(path)) {
        return pathEncoder.get(path);
      } else {
        addToMaps(path);
        return pathEncoder.get(path);
      }
    };

    for (const filepath of filepaths) {
      const contents = readFile(filepath)!
        .replace(/(\r\n|\n|\r)/gm, "")
        .toLowerCase();
      for (let word of contents.split(" ")) {
        word = word.toLowerCase();
        const pathCode = getPathCode(filepath);

        if (map.has(word)) {
          let arr = map.get(word)!;

          const item = {
            pathCode: pathCode,
            wordStart: contents.indexOf(word)
          } as IndexItem;

          arr = arr.filter(
            (i) =>
              i.pathCode !== item.pathCode && i.wordStart !== item.wordStart
          );

          arr.push(item);

          map.set(word, arr);
        } else {
          map.set(word, [
            {
              pathCode,
              wordStart: contents.indexOf(word)
            } as IndexItem
          ]);
        }
      }
    }

    const newIndex = new Index(map, pathEncoder, pathDecoder);
    newIndex.saveToFile(INDEX_PATH);

    return newIndex;
  }

  wordMapToObject() {
    const output = {} as any;
    this.wordMap.forEach((value: IndexItem[], key: string) => {
      output[key] = Array.from(value);
    });

    return output;
  }

  toString() {
    return JSON.stringify(
      {
        wordMap: this.wordMapToObject(),
        pathDecoder: Object.fromEntries(this.pathDecoder),
        pathEncoder: Object.fromEntries(this.pathEncoder)
      },
      null,
      2
    );
  }

  async saveToFile(filePath: string) {
    const json = this.toString();

    try {
      await fs.promises.writeFile(filePath, json);
      console.log(`Data saved to ${filePath}`);
    } catch (error) {
      console.error(`Error saving data to ${filePath}:`, error);
    }
  }

  static fromJSON(jsonData: Record<string, IndexItem[]>) {
    const data = new Map<string, Set<IndexItem>>();

    Object.entries(jsonData).forEach(([key, values]) => {
      data.set(key, new Set(values));
    });

    return null; //new Index(data);
  }
}

export function getIndex() {
  let index: Index;
  const files = getAllFiles().map((f) => f.filepath);
  if (fs.existsSync(INDEX_PATH)) {
    //index = Index.fromJSON(JSON.parse(readFile(INDEX_PATH)!));
    index = Index.build(files);
    console.log("Index loaded from", INDEX_PATH);
  } else {
    index = Index.build(files);
    console.log("Index built and saved to", INDEX_PATH);
  }

  return index;
}

export function readDirectory(dirPath: string) {
  try {
    const contents = fs.readdirSync(dirPath);
    const items = contents
      .filter((item) => {
        const split = item.split(".");
        return split.length > 1 && EXT_WHITELIST.includes(split[1]);
      })
      .map((item) => ({
        filepath: path.join(dirPath, item),
        filename: item
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
      console.log(META_PATH + " created successfully.");
    } catch (err) {
      console.error("Error creating folder:", err);
    }
  } else {
    console.log("Folder already exists.");
  }
}

function createDirList() {
  if (!fs.existsSync(DIR_LIST)) {
    try {
      fs.writeFileSync(DIR_LIST, "[]");
      console.log(DIR_LIST + " created successfully.");
    } catch (err) {
      console.error("Error creating file:", err);
    }
  } else {
    console.log(DIR_LIST + " already exists.");
  }
}

export function readFile(filepath: string) {
  try {
    return fs.readFileSync(filepath, "utf-8");
  } catch (err) {
    console.error("Error reading JSON file:", err);
  }
}

function readJSON(filepath: string) {
  try {
    const content = readFile(filepath)!;
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading JSON file:", err);
  }
}

function writeJSON(filepath: string, data: string[]) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8"); // Convert data to a formatted JSON string
    console.log(filepath + " written to file successfully.");
  } catch (err) {
    console.error("Error writing to file:", err);
  }
}

export function getAllFiles() {
  const savedDirectories = readJSON(DIR_LIST) as string[];
  let fileList = [] as any[];
  for (const directory of savedDirectories) {
    fileList = fileList.concat(readDirectory(directory));
  }

  return fileList.filter((file) => file.filename && file.filepath);
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

  console.log("updated file list:", fileList);

  return fileList;
}
