/* GraphQL 拉取 Discussions，靠游标把仓库里的全量翻完，不受前 100 条限制。
   单页上限 100，仓库文章多了就多翻几页，页码游标记在 Set 里，重复出现就说明服务端
   在原地打转，直接中止，免得死循环把令牌打到限流。

   这个文件里的错误全部向上抛，不做兜底。同步的调用方会把失败当成「这次什么都没拿到」，
   保留既有文章。也就是宁可这次不更新，也不能因为一次网络抖动把线上文章清空。 */
const query = `query QxBlogDiscussions($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    discussions(first: 100, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number title body createdAt updatedAt url isAnswered isClosed: closed
        author { login }
        category { name slug }
        labels(first: 100) { nodes { name } pageInfo { hasNextPage } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export async function fetchDiscussions({ repository, token, fetchImpl }) {
  const [owner, name] = repository.split('/');
  const discussions = [];
  const cursors = new Set();
  const numbers = new Set();
  let after = null;
  do {
    let response;
    try {
      response = await fetchImpl('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { owner, name, after } }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      // 不透传 fetch 抛出的原始错误，它可能把 Authorization 头带进日志。
      throw new Error('GitHub request failed; existing content was preserved');
    }
    if (!response.ok)
      throw new Error(
        `GitHub request failed (HTTP ${Number(response.status) || 'unknown'}); existing content was preserved`,
      );
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('GitHub returned invalid JSON; existing content was preserved');
    }
    if (result.errors?.length)
      throw new Error(
        'GitHub GraphQL reported errors; check repository access and token permissions',
      );
    const connection = result.data?.repository?.discussions;
    if (
      !connection ||
      !Array.isArray(connection.nodes) ||
      typeof connection.pageInfo?.hasNextPage !== 'boolean'
    ) {
      throw new Error(
        'GitHub returned an incomplete discussions snapshot; existing content was preserved',
      );
    }
    for (const node of connection.nodes) {
      if (
        !node ||
        !Number.isSafeInteger(node.number) ||
        node.number < 1 ||
        numbers.has(node.number)
      )
        throw new Error('GitHub returned an invalid or repeated discussion number');
      numbers.add(node.number);
      discussions.push(node);
    }
    if (!connection.pageInfo.hasNextPage) break;
    const next = connection.pageInfo.endCursor;
    if (typeof next !== 'string' || !next || cursors.has(next))
      throw new Error(
        'GitHub returned an invalid pagination cursor; existing content was preserved',
      );
    cursors.add(next);
    after = next;
  } while (true);
  return discussions;
}
