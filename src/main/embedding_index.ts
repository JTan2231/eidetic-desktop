import path from 'path';
import {
  META_PATH,
  createDirectoryIfMissing,
  getAllFiles,
  readDirectory,
  readFile,
  writeFile,
} from './serialization';
import { FileMeta, fileMetaFromPath } from '../type_util/types';
import { assert } from 'console';

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

function dot(e1: number[], e2: number[]) {
  assert(e1.length === e2.length);

  let sum = 0;
  for (let i = 0; i < e1.length; i++) {
    sum += e1[i] * e2[i];
  }

  return sum;
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
      console.log('getEmbedding response:', res.status, res.statusText);
      return res.json();
    })
    .then((res) => {
      console.log('getEmbedding JSON response:', res);
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
    const files: string[] = [];

    console.log('LOADING EMBEDDING INDEX at', this.directory);

    const arrayContains = (query: string) => {
      for (const file of embeddingFiles) {
        if (file.filepath.includes(query)) {
          return true;
        }
      }

      return false;
    };

    for (const file of filenames) {
      const contents = readFile(file.filepath)!.substring(0, 10);
      const candidateFilepath = buildFilename(this.directory, contents, 0);
      if (arrayContains(candidateFilepath)) {
        console.log(`${candidateFilepath} loaded`);
        files.push(candidateFilepath);
      }
    }

    this.files = files;
  }

  rank(query: string) {
    type EmbeddingRank = {
      dot: number;
      embed: EmbeddingFileMeta;
    };

    return getEmbedding(query).then((queryEmbedding) => {
      const ranking = [] as EmbeddingRank[];

      for (const filepath of this.files) {
        const embeddingMeta = JSON.parse(
          readFile(filepath)!
        ) as EmbeddingFileMeta;
        const dotValue = dot(queryEmbedding, embeddingMeta.embedding.data);

        ranking.push({ dot: dotValue, embed: embeddingMeta });
      }

      ranking.sort((a, b) => b.dot - a.dot);

      return ranking.map((rank) => fileMetaFromPath(rank.embed.source));
    });
  }

  clean() {
    const existingFiles = readDirectory(this.directory);

    for (const existingFile of existingFiles) {
    }
  }
}
