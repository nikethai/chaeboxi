#!/usr/bin/env tsx
/**
 * What changed digest: reports docs changes, commits, uncommitted work,
 * branches and board moves since a timestamp.
 *
 * Bootstrap for the shared-core repo source (ADR 0011, TASK-3).
 *
 * Usage:
 *   pnpm whats-changed [--since=TIMESTAMP]
 *
 * Timestamp: ISO8601 or human-readable (e.g., "2 days ago", "last week").
 * Defaults to 7 days ago if omitted.
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface DigestOptions {
  since: string;
}

function parseArgs(): DigestOptions {
  const args = process.argv.slice(2);
  let since = '7 days ago';

  for (const arg of args) {
    if (arg.startsWith('--since=')) {
      since = arg.slice(8);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: pnpm whats-changed [--since=TIMESTAMP]

Reports changes since TIMESTAMP:
  - New/changed ADRs and specs (from docs/log.md)
  - Commits grouped by author and branch
  - Uncommitted files (staged, unstaged, untracked)
  - New/deleted branches
  - Backlog board moves

Timestamp examples:
  --since="2026-10-15T10:00:00+07:00"  (ISO8601)
  --since="2 days ago"
  --since="last week"

Defaults to 7 days ago if omitted.
`);
      process.exit(0);
    }
  }

  return { since };
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function parseDocsLog(since: string): string[] {
  const logPath = 'docs/log.md';
  try {
    const content = readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const changes: string[] = [];
    let currentDate = '';
    const sinceTimestamp = new Date(exec(`git log -1 --since="${since}" --format=%ai`) || since).getTime();

    for (const line of lines) {
      const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})$/);
      if (dateMatch) {
        currentDate = dateMatch[1];
        const lineDate = new Date(currentDate).getTime();
        if (lineDate < sinceTimestamp && changes.length > 0) break;
      } else if (currentDate && line.match(/^\* \*\*(Creation|Proposal|Acceptance|Update|Implementation|Reorganisation):/)) {
        const entryDate = new Date(currentDate).getTime();
        if (entryDate >= sinceTimestamp) {
          changes.push(`  ${line.trim()}`);
        }
      }
    }

    return changes;
  } catch {
    return [];
  }
}

function getCommits(since: string): Map<string, string[]> {
  const log = exec(`git log --all --since="${since}" --format=%H%x00%an%x00%s%x00%D`);
  if (!log) return new Map();

  const lines = log.split('\n').filter(Boolean);
  const byAuthor = new Map<string, string[]>();

  for (const line of lines) {
    const [hash, author, subject, refs] = line.split('\x00');
    const shortHash = hash.slice(0, 7);
    const branches = refs
      .split(',')
      .map(r => r.trim())
      .filter(r => r.startsWith('origin/') || (!r.includes('HEAD') && !r.includes('tag:')))
      .map(r => r.replace(/^origin\//, ''))
      .join(', ');

    const entry = branches ? `${shortHash} ${subject} [${branches}]` : `${shortHash} ${subject}`;

    if (!byAuthor.has(author)) {
      byAuthor.set(author, []);
    }
    byAuthor.get(author)!.push(entry);
  }

  return byAuthor;
}

function getUncommittedFiles(): { staged: string[]; unstaged: string[]; untracked: string[] } {
  const status = exec('git status --porcelain');
  if (!status) return { staged: [], unstaged: [], untracked: [] };

  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];

  for (const line of status.split('\n')) {
    if (!line) continue;
    const index = line[0];
    const workingTree = line[1];
    const file = line.slice(3);

    if (index !== ' ' && index !== '?') staged.push(file);
    if (workingTree !== ' ' && workingTree !== '?') unstaged.push(file);
    if (index === '?' && workingTree === '?') untracked.push(file);
  }

  return { staged, unstaged, untracked };
}

function getBranchChanges(since: string): { new: string[]; deleted: string[] } {
  const allBranches = exec('git for-each-ref --format=%(refname:short)%x00%(committerdate:iso8601) refs/heads refs/remotes')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, date] = line.split('\x00');
      return { name: name.replace(/^origin\//, ''), date: new Date(date) };
    });

  const sinceDate = new Date(exec(`git log -1 --since="${since}" --format=%ai`) || since);

  const newBranches = allBranches
    .filter(b => b.date >= sinceDate)
    .map(b => b.name)
    .filter((name, idx, arr) => arr.indexOf(name) === idx);

  // Deleted branches: in reflog but not in current branches
  const currentBranches = new Set(allBranches.map(b => b.name));
  const reflog = exec(`git reflog --since="${since}" --format=%gs`)
    .split('\n')
    .filter(msg => msg.includes('deleted') && msg.includes('branch'));

  const deleted = reflog
    .map(msg => {
      const match = msg.match(/deleted branch (.+?) /);
      return match ? match[1] : null;
    })
    .filter((name): name is string => name !== null && !currentBranches.has(name))
    .filter((name, idx, arr) => arr.indexOf(name) === idx);

  return { new: newBranches, deleted };
}

function getBacklogMoves(since: string): string[] {
  const backlogDir = 'backlog/tasks';
  try {
    const files = readdirSync(backlogDir).filter(f => f.endsWith('.md'));
    const moves: string[] = [];

    for (const file of files) {
      const path = join(backlogDir, file);
      const log = exec(`git log --since="${since}" --format=%H%x00%s -- "${path}"`);
      if (!log) continue;

      const lines = log.split('\n').filter(Boolean);
      for (const line of lines) {
        const [hash, subject] = line.split('\x00');
        if (subject.toLowerCase().includes('move') || subject.toLowerCase().includes('status')) {
          const shortHash = hash.slice(0, 7);
          moves.push(`${file.replace('.md', '')}: ${subject} (${shortHash})`);
        }
      }
    }

    // Also check current status vs git history
    for (const file of files) {
      const path = join(backlogDir, file);
      const content = readFileSync(path, 'utf8');
      const statusMatch = content.match(/^status:\s*(.+)$/m);
      if (!statusMatch) continue;

      const currentStatus = statusMatch[1].trim();
      const oldContent = exec(`git show HEAD~1:"${path}" 2>/dev/null`);
      if (!oldContent) continue;

      const oldStatusMatch = oldContent.match(/^status:\s*(.+)$/m);
      if (oldStatusMatch && oldStatusMatch[1].trim() !== currentStatus) {
        const taskId = file.match(/^task-(\d+)/)?.[1] || file.replace('.md', '');
        moves.push(`TASK-${taskId}: ${oldStatusMatch[1]} → ${currentStatus} (uncommitted)`);
      }
    }

    return moves;
  } catch {
    return [];
  }
}

function main() {
  const { since } = parseArgs();

  console.log(`What changed since ${since}\n`);

  // 1. Docs changes
  const docsChanges = parseDocsLog(since);
  if (docsChanges.length > 0) {
    console.log('📚 Docs (ADRs, specs, research):\n');
    docsChanges.forEach(change => console.log(change));
    console.log();
  }

  // 2. Commits by author
  const commits = getCommits(since);
  if (commits.size > 0) {
    console.log('📝 Commits:\n');
    commits.forEach((commitList, author) => {
      console.log(`  ${author}:`);
      commitList.forEach(commit => console.log(`    ${commit}`));
    });
    console.log();
  }

  // 3. Uncommitted files
  const uncommitted = getUncommittedFiles();
  if (uncommitted.staged.length + uncommitted.unstaged.length + uncommitted.untracked.length > 0) {
    console.log('🔧 Uncommitted work:\n');
    if (uncommitted.staged.length > 0) {
      console.log('  Staged:');
      uncommitted.staged.forEach(f => console.log(`    ${f}`));
    }
    if (uncommitted.unstaged.length > 0) {
      console.log('  Unstaged:');
      uncommitted.unstaged.forEach(f => console.log(`    ${f}`));
    }
    if (uncommitted.untracked.length > 0) {
      console.log('  Untracked:');
      uncommitted.untracked.forEach(f => console.log(`    ${f}`));
    }
    console.log();
  }

  // 4. Branch changes
  const branches = getBranchChanges(since);
  if (branches.new.length > 0 || branches.deleted.length > 0) {
    console.log('🌿 Branches:\n');
    if (branches.new.length > 0) {
      console.log('  New:');
      branches.new.forEach(b => console.log(`    ${b}`));
    }
    if (branches.deleted.length > 0) {
      console.log('  Deleted:');
      branches.deleted.forEach(b => console.log(`    ${b}`));
    }
    console.log();
  }

  // 5. Board moves
  const moves = getBacklogMoves(since);
  if (moves.length > 0) {
    console.log('📋 Backlog moves:\n');
    moves.forEach(move => console.log(`  ${move}`));
    console.log();
  }

  if (
    docsChanges.length === 0 &&
    commits.size === 0 &&
    uncommitted.staged.length === 0 &&
    uncommitted.unstaged.length === 0 &&
    uncommitted.untracked.length === 0 &&
    branches.new.length === 0 &&
    branches.deleted.length === 0 &&
    moves.length === 0
  ) {
    console.log('Nothing changed.\n');
  }
}

main();
