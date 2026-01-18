export async function onRequest(context: { request: Request; env: Record<string, string> }) {
  const { request, env } = context;
  const url = new URL(request.url);

  const workerHost = env.WORKER_HOSTNAME || 'your-worker-hostname.workers.dev';
  const workerUrl = new URL(request.url);
  workerUrl.hostname = workerHost;
  workerUrl.protocol = 'https:';

  const proxyRequest = new Request(workerUrl.toString(), request);
  return fetch(proxyRequest);
}
