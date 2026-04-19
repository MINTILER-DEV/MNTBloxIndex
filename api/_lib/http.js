export function json(data, init = {})
{
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("content-type"))
  {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  if (!headers.has("cache-control"))
  {
    headers.set("cache-control", "no-store");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function error(status, message)
{
  return json({ error: message }, { status });
}
