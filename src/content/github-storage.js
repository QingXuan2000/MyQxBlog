/* 同步结果的落盘。职责分成两半，读出现有源文件，判断哪些归同步管；
   以及把一批增删改安全地写回去，失败时恢复到动手之前的样子。

   写回不是逐个文件直接覆盖。新内容先写进 .qxblog-sync-xxx 临时目录，全部写完才开始
   替换，中途出错就按记录逆序还原。已删的文件也能补回来，因为原文在内存里留着。

   判断「归同步管」靠三个标记同时成立，source 是 github-discussion、仓库名对得上、
   Discussion 编号是正整数。只认 source 会把别的论坛同步过来的文章也吃掉。 */
import {
  lstat,
  readFile,
  readdir,
  mkdir,
  mkdtemp,
  writeFile,
  rename,
  unlink,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { safeSegment } from './metadata.js';

export async function jsonFile(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw new Error(`${path.basename(filename)}: invalid or unreadable JSON`, { cause: error });
  }
}

export async function readExistingSources(root, repository) {
  const entries = [];
  const directory = 'content/posts';
  for (const relative of [directory.split('/')[0], directory]) {
    try {
      if ((await lstat(path.join(root, relative))).isSymbolicLink())
        throw new Error(`${relative}: source directories must not be symbolic links`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  let files;
  try {
    files = await readdir(path.join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return entries;
    throw error;
  }
  for (const file of files) {
    if (!/\.md$/i.test(file.name)) continue;
    if (file.isSymbolicLink())
      throw new Error(
        `${directory}/${file.name}: symbolic link Markdown is not supported for sync`,
      );
    if (!file.isFile()) continue;
    const filename = path.join(root, directory, file.name);
    try {
      const previous = await readFile(filename, 'utf8');
      const { data } = parseFrontmatter(previous);
      const id = safeSegment(data.id ?? path.basename(file.name, path.extname(file.name)));
      const managed =
        data.source === 'github-discussion' &&
        typeof data.sourceRepository === 'string' &&
        data.sourceRepository.toLowerCase() === repository.toLowerCase() &&
        Number.isSafeInteger(data.sourceDiscussionNumber) &&
        data.sourceDiscussionNumber > 0;
      entries.push({ filename, previous, id, managed, number: data.sourceDiscussionNumber });
    } catch (error) {
      throw new Error(`${directory}/${file.name}: ${error.message}`, { cause: error });
    }
  }
  return entries;
}

export async function applySourceChanges(root, changes) {
  if (!changes.length) return;
  const stage = await mkdtemp(path.join(root, '.qxblog-sync-'));
  const applied = [];
  try {
    // 先备好所有新文件，再替换任何已有源文件。
    for (let index = 0; index < changes.length; index++) {
      if (changes[index].next !== null)
        await writeFile(path.join(stage, String(index)), changes[index].next, 'utf8');
    }
    await mkdir(path.join(root, 'content/posts'), { recursive: true });
    for (let index = 0; index < changes.length; index++) {
      const change = changes[index];
      if (change.next === null) await unlink(change.filename);
      else await rename(path.join(stage, String(index)), change.filename);
      applied.push(change);
    }
  } catch (error) {
    const failures = [];
    for (const change of applied.reverse()) {
      try {
        if (change.previous === undefined) await rm(change.filename, { force: true });
        else await writeFile(change.filename, change.previous, 'utf8');
      } catch (restoreError) {
        failures.push(restoreError);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        'Sync write failed and source rollback was incomplete',
      );
    throw new Error('Sync write failed; previous source files were restored', { cause: error });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
