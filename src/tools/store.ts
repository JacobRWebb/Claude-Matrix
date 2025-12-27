import { getDb, embeddingToBuffer, searchSimilarSolutions } from '../db/client.js';
import { getEmbedding } from '../embeddings/local.js';
import { randomUUID } from 'crypto';
import { fingerprintRepo, getOrCreateRepo } from '../repo/index.js';
import type { SolutionCategory, CodeBlock } from '../types/db.js';

interface StoreInput {
  problem: string;
  solution: string;
  scope: 'global' | 'stack' | 'repo';
  tags?: string[];
  filesAffected?: string[];
  category?: SolutionCategory;
  complexity?: number;
  prerequisites?: string[];
  antiPatterns?: string[];
  codeBlocks?: CodeBlock[];
  relatedSolutions?: string[];
  supersedes?: string;
}

interface StoreResult {
  id: string;
  status: 'stored' | 'duplicate' | 'superseded';
  problem: string;
  scope: string;
  tags: string[];
  similarity?: number;
  category?: SolutionCategory;
  complexity?: number;
  supersededId?: string;
}

function calculateComplexity(input: StoreInput): number {
  let score = 1;
  score += Math.min(4, Math.floor(input.solution.length / 500));
  if (input.codeBlocks?.length) score += Math.min(2, input.codeBlocks.length);
  if (input.prerequisites?.length) score += Math.min(2, input.prerequisites.length);
  if (input.filesAffected?.length) score += Math.min(2, Math.floor(input.filesAffected.length / 2));
  return Math.min(10, Math.max(1, score));
}

export async function matrixStore(input: StoreInput): Promise<StoreResult> {
  const db = getDb();
  const id = `sol_${randomUUID().slice(0, 8)}`;

  const detected = fingerprintRepo();
  const repoId = await getOrCreateRepo(detected);
  const embedding = await getEmbedding(input.problem);

  const duplicates = searchSimilarSolutions(embedding, 1, 0.9);
  if (duplicates.length > 0) {
    const existing = db.query('SELECT id, problem, category FROM solutions WHERE id = ?')
      .get(duplicates[0]!.id) as { id: string; problem: string; category: string | null } | null;

    if (existing) {
      return {
        id: existing.id,
        status: 'duplicate',
        problem: existing.problem.slice(0, 100) + (existing.problem.length > 100 ? '...' : ''),
        scope: input.scope,
        tags: input.tags || [],
        similarity: Math.round(duplicates[0]!.similarity * 1000) / 1000,
        category: existing.category as SolutionCategory | undefined,
      };
    }
  }

  const embBuffer = embeddingToBuffer(embedding);
  const context = JSON.stringify({ filesAffected: input.filesAffected || [] });
  const tags = JSON.stringify(input.tags || []);
  const complexity = input.complexity ?? calculateComplexity(input);
  const prerequisites = JSON.stringify(input.prerequisites || []);
  const antiPatterns = JSON.stringify(input.antiPatterns || []);
  const codeBlocks = JSON.stringify(input.codeBlocks || []);
  const relatedSolutions = JSON.stringify(input.relatedSolutions || []);

  if (input.supersedes) {
    const superseded = db.query('SELECT id FROM solutions WHERE id = ?').get(input.supersedes);
    if (!superseded) {
      throw new Error(`Cannot supersede non-existent solution: ${input.supersedes}`);
    }
  }

  db.query(`
    INSERT INTO solutions (
      id, repo_id, problem, problem_embedding, solution, scope, context, tags, score,
      category, complexity, prerequisites, anti_patterns, code_blocks, related_solutions, supersedes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.5, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, repoId, input.problem, embBuffer, input.solution, input.scope, context, tags,
    input.category || null, complexity, prerequisites, antiPatterns, codeBlocks, relatedSolutions,
    input.supersedes || null
  );

  return {
    id,
    status: input.supersedes ? 'superseded' : 'stored',
    problem: input.problem.slice(0, 100) + (input.problem.length > 100 ? '...' : ''),
    scope: input.scope,
    tags: input.tags || [],
    category: input.category,
    complexity,
    supersededId: input.supersedes,
  };
}
