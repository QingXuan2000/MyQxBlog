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
      // 不透传 fetch 错误，其中可能携带鉴权头。
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
