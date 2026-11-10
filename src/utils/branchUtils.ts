import { getPool } from '../db/mysql';

/**
 * Validates that `branch` is a known branch name from the `branches` table.
 * This replaces all hardcoded `assertBranch` checks across route files,
 * allowing any admin-defined branch to work throughout the system.
 */
export async function assertBranchExists(branch: any): Promise<string> {
  if (typeof branch !== 'string' || branch.trim().length === 0) {
    throw { error: 'Branch name is required.' };
  }
  const name = branch.trim();
  const pool = getPool();
  const [rows]: any = await pool.query(
    'SELECT id FROM branches WHERE name = ? LIMIT 1',
    [name]
  );
  if (!rows || rows.length === 0) {
    throw { error: `Invalid branch: "${name}". Use a branch name defined in Admin Settings.` };
  }
  return name;
}

/**
 * Synchronous fallback used where a DB call is impractical
 * (e.g., legacy assertBranch call sites). Accepts any non-empty string.
 */
export function assertBranchSync(branch: any): string {
  if (typeof branch !== 'string' || branch.trim().length === 0) {
    throw { error: 'Branch name is required.' };
  }
  return branch.trim();
}
