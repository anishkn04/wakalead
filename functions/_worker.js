// Cloudflare Pages _worker.js configuration
// This proxies API requests to the Cloudflare Worker

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Proxy API requests to Worker
    if (url.pathname.startsWith('/api/')) {
      // Forward to your deployed worker
      const workerUrl = new URL(request.url);
      workerUrl.hostname = 'your-worker.your-subdomain.workers.dev';
      
      return fetch(workerUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    
    // Serve static files for everything else
    return env.ASSETS.fetch(request);
  },
};
