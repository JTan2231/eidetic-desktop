import path from 'path';
import {
  META_PATH,
  createDirectoryIfMissing,
  getAllFiles,
  readDirectory,
  readFile,
  writeFile,
} from './serialization';
import { FileMeta } from 'type_util/types';

const DEFAULT_DIRECTORY = path.join(META_PATH, 'embeddings');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

class Embedding {
  data: number[];

  constructor(data: number[]) {
    this.data = data.length === 1536 ? data : [];
  }

  isMalformed() {
    for (const n of this.data) {
      if (n === null || n === undefined) {
        return true;
      }
    }

    return this.data.length !== 1536;
  }

  magnitude() {
    if (this.isMalformed()) {
      console.error('malformed embedding used');
      return;
    }

    let sum = 0;
    for (const n of this.data) {
      sum += n * n;
    }

    return Math.sqrt(sum);
  }

  normalize() {
    if (this.isMalformed()) {
      console.error('malformed embedding used');
      return;
    }

    const mag = this.magnitude()!;
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] /= mag;
    }
  }
}

type EmbeddingFileMeta = {
  path: string;
  source: string;
  embedding: Embedding;
};

async function getEmbedding(contents: string) {
  let embeddingData = [] as number[];
  await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: contents,
    }),
  })
    .then((res) => {
      return res.json();
    })
    .then((res) => {
      embeddingData = res.data[0].embedding;
    });

  return embeddingData;
}

function buildFilename(directory: string, content: string, index: number) {
  content = path.join(directory, content);
  content += index ? '-' + index : '';
  content += '.json';

  return content;
}

export class EmbeddingIndex {
  directory: string;
  files: string[];

  constructor(directory: string | null, files: string[]) {
    this.directory = directory ? directory : DEFAULT_DIRECTORY;
    if (files.length === 0) {
      this.files = getAllFiles().map((f) => f.filepath);
    } else {
      this.files = files;
    }

    createDirectoryIfMissing(this.directory);
  }

  build(files: string[]) {
    const filenames = new Set<string>();
    for (const file of files) {
      const contents = readFile(file)!;
      getEmbedding(contents).then((data) => {
        const filename = contents.substring(0, 10);
        const meta = {
          path: buildFilename(this.directory, filename, 0),
          source: file,
          embedding: new Embedding(data),
        } as EmbeddingFileMeta;

        let index = 0;
        while (filenames.has(buildFilename(this.directory, filename, index))) {
          index++;
        }

        meta.path = buildFilename(this.directory, filename, index);

        writeFile(meta.path, JSON.stringify(meta));
        this.files.push(meta.path);
      });
    }

    this.files = files;
  }

  load(filenames: FileMeta[]) {
    const embeddingFiles = readDirectory(this.directory);

    const arrayContains = (query: string) => {
      for (const file of embeddingFiles) {
        if (file.filepath.includes(query)) {
          return true;
        }
      }

      return false;
    };

    for (const file of filenames) {
      const contents = readFile(file.filepath)!;
      const candidateFilepath = buildFilename(this.directory, contents, 0);
      if (arrayContains(candidateFilepath)) {
        this.files.push(candidateFilepath);
      }
    }
  }

  clean() {
    const existingFiles = readDirectory(this.directory);

    for (const existingFile of existingFiles) {
    }
  }
}
