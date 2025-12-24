// Pure utilities - no transformers dependency
export { cosineSimilarity, EMBEDDING_DIM } from './utils.js';

// Lazy-loaded embedding functions
export async function getEmbedding(text: string): Promise<Float32Array> {
  const { getEmbedding: _getEmbedding } = await import('./local.js');
  return _getEmbedding(text);
}

export async function getEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const { getEmbeddings: _getEmbeddings } = await import('./local.js');
  return _getEmbeddings(texts);
}
