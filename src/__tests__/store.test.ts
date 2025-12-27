import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createTestDb, closeTestDb, mockEmbedding, embeddingToBuffer } from './helpers.js';

let mockDb: ReturnType<typeof createTestDb>;

describe('solution storage', () => {
  beforeEach(() => {
    mockDb = createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  test('stores solution with all fields', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);
    const tags = JSON.stringify(['auth', 'oauth']);
    const context = JSON.stringify({ filesAffected: ['auth.ts'] });

    mockDb.query(`
      INSERT INTO solutions (id, problem, problem_embedding, solution, scope, context, tags, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.5)
    `).run('sol_001', 'OAuth integration', embBuffer, 'Use passport.js', 'global', context, tags);

    const solution = mockDb.query('SELECT * FROM solutions WHERE id = ?').get('sol_001') as {
      id: string;
      problem: string;
      solution: string;
      scope: string;
      tags: string;
      score: number;
    };

    expect(solution.id).toBe('sol_001');
    expect(solution.problem).toBe('OAuth integration');
    expect(solution.solution).toBe('Use passport.js');
    expect(solution.scope).toBe('global');
    expect(JSON.parse(solution.tags)).toEqual(['auth', 'oauth']);
    expect(solution.score).toBe(0.5);
  });

  test('generates unique IDs', () => {
    const id1 = `sol_${crypto.randomUUID().slice(0, 8)}`;
    const id2 = `sol_${crypto.randomUUID().slice(0, 8)}`;
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^sol_[a-f0-9]{8}$/);
  });

  test('handles empty tags', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    mockDb.query(`
      INSERT INTO solutions (id, problem, problem_embedding, solution, scope, tags, score)
      VALUES (?, ?, ?, ?, ?, ?, 0.5)
    `).run('sol_001', 'Problem', embBuffer, 'Solution', 'global', '[]');

    const solution = mockDb.query('SELECT tags FROM solutions WHERE id = ?').get('sol_001') as { tags: string };
    expect(JSON.parse(solution.tags)).toEqual([]);
  });

  test('enforces scope constraint', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    expect(() => {
      mockDb.query(`
        INSERT INTO solutions (id, problem, problem_embedding, solution, scope, score)
        VALUES (?, ?, ?, ?, ?, 0.5)
      `).run('sol_001', 'Problem', embBuffer, 'Solution', 'invalid');
    }).toThrow();
  });

  test('stores with default values', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    mockDb.query(`
      INSERT INTO solutions (id, problem, problem_embedding, solution, scope)
      VALUES (?, ?, ?, ?, ?)
    `).run('sol_001', 'Problem', embBuffer, 'Solution', 'global');

    const solution = mockDb.query('SELECT score, uses, successes, failures FROM solutions WHERE id = ?').get('sol_001') as {
      score: number;
      uses: number;
      successes: number;
      failures: number;
    };

    expect(solution.score).toBe(0.5);
    expect(solution.uses).toBe(0);
    expect(solution.successes).toBe(0);
    expect(solution.failures).toBe(0);
  });

  test('stores enhanced metadata', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    mockDb.query(`
      INSERT INTO solutions (id, problem, problem_embedding, solution, scope, category, complexity, prerequisites)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('sol_001', 'Problem', embBuffer, 'Solution', 'global', 'feature', 5, '["Node.js >= 18"]');

    const solution = mockDb.query('SELECT category, complexity, prerequisites FROM solutions WHERE id = ?').get('sol_001') as {
      category: string; complexity: number; prerequisites: string;
    };

    expect(solution.category).toBe('feature');
    expect(solution.complexity).toBe(5);
    expect(JSON.parse(solution.prerequisites)).toEqual(['Node.js >= 18']);
  });

  test('enforces category constraint', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    expect(() => {
      mockDb.query(`INSERT INTO solutions (id, problem, problem_embedding, solution, scope, category)
        VALUES (?, ?, ?, ?, ?, ?)`).run('sol_001', 'Problem', embBuffer, 'Solution', 'global', 'invalid');
    }).toThrow();
  });

  test('enforces complexity range', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    expect(() => {
      mockDb.query(`INSERT INTO solutions (id, problem, problem_embedding, solution, scope, complexity)
        VALUES (?, ?, ?, ?, ?, ?)`).run('sol_001', 'Problem', embBuffer, 'Solution', 'global', 11);
    }).toThrow();
  });

  test('stores supersedes relationship', () => {
    const emb = mockEmbedding(384, 1);
    const embBuffer = embeddingToBuffer(emb);

    mockDb.query(`INSERT INTO solutions (id, problem, problem_embedding, solution, scope)
      VALUES (?, ?, ?, ?, ?)`).run('sol_old', 'Old', embBuffer, 'Old solution', 'global');

    mockDb.query(`INSERT INTO solutions (id, problem, problem_embedding, solution, scope, supersedes)
      VALUES (?, ?, ?, ?, ?, ?)`).run('sol_new', 'New', embBuffer, 'New solution', 'global', 'sol_old');

    const solution = mockDb.query('SELECT supersedes FROM solutions WHERE id = ?').get('sol_new') as { supersedes: string };
    expect(solution.supersedes).toBe('sol_old');
  });
});
