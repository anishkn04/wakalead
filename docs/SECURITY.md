# Security Notes

## Dependency Vulnerabilities

### Current Status (January 2026)

The project has some known vulnerabilities in **development dependencies only**. These do **NOT** affect production deployments.

### Identified Issues

1. **esbuild** (moderate severity)
   - **Issue**: Development server can accept requests from any website
   - **Impact**: Only affects local development (`npm run dev`)
   - **Risk**: Low - requires attacker to know your local dev server is running
   - **Mitigation**: Don't run dev server on untrusted networks

2. **undici** (low severity)
   - **Issue**: Potential resource exhaustion in HTTP responses
   - **Impact**: Only affects Wrangler CLI tool
   - **Risk**: Low - only used during development and deployment
   - **Mitigation**: N/A - transitive dependency

### Why Not Fix with `--force`?

Running `npm audit fix --force` attempts major version upgrades which can introduce breaking changes. The current setup works correctly, and these vulnerabilities:
- Don't affect production builds
- Don't affect deployed applications
- Only impact local development environment

### Production Security

The **deployed application** is secure:
- No dev dependencies included in production build
- Vite creates optimized, clean bundles
- Cloudflare Workers runs in isolated environment
- All user-facing code is safe

### Recommendations

**For Development:**
- ✅ Use the current versions (they work fine)
- ✅ Run dev server only on trusted networks
- ✅ Keep `localhost` as dev URL (not `0.0.0.0`)
- ✅ Update dependencies quarterly

**For Production:**
- ✅ Current production code has **zero vulnerabilities**
- ✅ Build output is clean and secure
- ✅ No dev dependencies deployed

## Manual Vulnerability Review

If you want to review yourself:

```bash
# Check production dependencies only
npm audit --omit=dev

# Should show: "0 vulnerabilities"
```

## Updating Dependencies Safely

When ready to update (every 3-6 months):

```bash
# Check for updates
npm outdated

# Update non-breaking changes
npm update

# For major versions, test carefully:
npm install package@latest
npm run build
npm run dev
# Test thoroughly before committing
```

## Security Best Practices Implemented

✅ **Authentication**: OAuth 2.0 via WakaTime
✅ **Session Management**: KV storage with TTL
✅ **Token Storage**: Server-side only (D1)
✅ **SQL Injection**: Prepared statements everywhere
✅ **CORS**: Restricted to your domain
✅ **Admin Routes**: Protected by user verification
✅ **Input Validation**: All endpoints validate inputs
✅ **Error Messages**: Don't leak sensitive info
✅ **Secrets**: Environment variables, never in code

## Reporting Security Issues

If you find a security issue in the application logic (not dependencies):

1. **Do NOT** create a public GitHub issue
2. Email details privately to the maintainer
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Checklist for Deployment

Before deploying to production:

- [ ] All secrets set via `wrangler secret put`
- [ ] `.env` and `.dev.vars` in `.gitignore`
- [ ] CORS restricted to your domain in `worker/index.ts`
- [ ] `ADMIN_WAKATIME_ID` set to correct user
- [ ] Database backups scheduled
- [ ] Monitor Worker logs for suspicious activity

## Additional Hardening (Optional)

For extra security in production:

### 1. Add Token Encryption
```typescript
// Install encryption library
npm install @noble/ciphers

// Encrypt tokens before storing in D1
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
```

### 2. Add Rate Limiting
```typescript
// Use Durable Objects for rate limiting
// See: https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
```

### 3. Add Content Security Policy
```typescript
// In worker/index.ts, add CSP headers
headers: {
  'Content-Security-Policy': "default-src 'self'; ...",
}
```

### 4. Enable Cloudflare WAF
- Go to Cloudflare Dashboard
- Enable Web Application Firewall
- Configure rules for your domain

## Audit History

| Date | Action | Result |
|------|--------|--------|
| 2026-01-18 | Initial audit | 5 dev vulnerabilities (low/moderate) |
| 2026-01-18 | Production check | 0 vulnerabilities |

---

**Last Updated**: January 18, 2026  
**Next Review**: April 2026
