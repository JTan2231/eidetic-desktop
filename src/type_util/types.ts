export type FileMeta = {
  filepath: string;
  filename: string;
  context?: string;
  keywordIndex?: number; // relative to context
  keywordLength?: number;
};

export type ViewMeta = {
  content: string;
  fileType: string;
};

export const FILE_TYPES = {
  pdf: 'pdf',
  markdown: 'md',
  plaintext: 'txt',
  html: 'html',
};
