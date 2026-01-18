# Contributing to WakaLead

## 🎯 Future Enhancement Ideas

### High Priority
- [ ] **Token Encryption**: Add encryption for stored access tokens
- [ ] **Rate Limiting**: Implement rate limiting on admin endpoints
- [ ] **Error Boundaries**: Add React error boundaries for graceful failures
- [ ] **Loading Indicators**: More granular loading states
- [ ] **Toast Notifications**: User feedback for actions

### Medium Priority
- [ ] **Monthly Leaderboards**: Extend beyond weekly
- [ ] **Project Breakdown**: Show stats per project
- [ ] **Language Stats**: Visualize by programming language
- [ ] **Editor Stats**: Track which editors are used
- [ ] **Time of Day Analysis**: When do users code most?
- [ ] **Streak Tracking**: Consecutive coding days

### Low Priority
- [ ] **Achievements/Badges**: Gamification elements
- [ ] **Team Comparisons**: Compare multiple groups
- [ ] **Export to CSV**: Download leaderboard data
- [ ] **Public Pages**: Shareable leaderboard links
- [ ] **Discord/Slack Integration**: Post updates to chat
- [ ] **Email Summaries**: Weekly coding report emails

## 🔧 How to Add Features

### Adding a New API Endpoint

1. **Define the route** in [worker/index.ts](worker/index.ts):
```typescript
if (path === '/api/your-endpoint') {
  // Your logic here
  return jsonResponse(data);
}
```

2. **Add database queries** in [worker/database.ts](worker/database.ts):
```typescript
export async function yourQuery(env: Env, params: any) {
  const results = await env.DB.prepare('YOUR SQL').bind(params).all();
  return results.results;
}
```

3. **Update API client** in [src/api.ts](src/api.ts):
```typescript
async yourEndpoint(params: any): Promise<Response> {
  return this.request<Response>('/your-endpoint');
}
```

4. **Use in components**: Call via `api.yourEndpoint()`

### Adding a New Component

1. **Create file** in `src/components/YourComponent.tsx`:
```typescript
import React from 'react';

interface YourComponentProps {
  // Props
}

export function YourComponent({ }: YourComponentProps) {
  return (
    <div className="...">
      {/* Your JSX */}
    </div>
  );
}
```

2. **Import and use** in Dashboard or other pages

### Adding Database Tables

1. **Update schema** in [schema.sql](schema.sql):
```sql
CREATE TABLE IF NOT EXISTS your_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Your columns
);

CREATE INDEX idx_your_table_field ON your_table(field);
```

2. **Run migration**:
```bash
npm run db:migrate
```

3. **Add queries** in [worker/database.ts](worker/database.ts)

### Adding New Scheduled Tasks

1. **Create function** in [worker/fetcher.ts](worker/fetcher.ts):
```typescript
export async function yourScheduledTask(env: Env): Promise<void> {
  // Your task logic
}
```

2. **Call from worker** in [worker/index.ts](worker/index.ts):
```typescript
async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
  await yourScheduledTask(env);
}
```

3. **Update cron** in [wrangler.toml](wrangler.toml):
```toml
crons = ["0 2 * * *", "0 14 * * *"]  # Add more triggers
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

Before committing:
- [ ] Test locally with `npm run dev` + `npm run worker:dev`
- [ ] Check TypeScript compilation: `npx tsc --noEmit`
- [ ] Test on mobile device or browser DevTools mobile view
- [ ] Test in both dark and light modes
- [ ] Test with network throttling (slow 3G)
- [ ] Test error cases (invalid inputs, network errors)

### Browser Testing

Recommended browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

## 📝 Code Style

### TypeScript
- Use `interface` for object types
- Use `type` for unions and aliases
- Export types from `types.ts` or at top of file
- Always type function parameters and returns
- Use `async/await` over `.then()` chains

### React
- Functional components only (no class components)
- Use TypeScript interfaces for props
- Destructure props in function signature
- Use meaningful component names (PascalCase)
- Keep components focused (single responsibility)

### CSS/Tailwind
- Use Tailwind utility classes
- Group related classes: `flex items-center space-x-2`
- Use dark mode classes: `bg-white dark:bg-gray-800`
- Custom CSS only when necessary
- Responsive: `sm:`, `md:`, `lg:`, `xl:` prefixes

### SQL
- Use prepared statements (always)
- Add indexes for commonly queried fields
- Use `ON CONFLICT` for upserts
- Name constraints descriptively
- Add comments for complex queries

### Comments
- Explain *why*, not *what*
- Document complex logic
- Add JSDoc for exported functions
- Include examples for non-obvious usage

## 🔐 Security Considerations

### When Adding Features

- **Never expose tokens**: Keep API credentials server-side only
- **Validate inputs**: Check all user inputs before processing
- **Check permissions**: Verify admin status for admin routes
- **Sanitize SQL**: Always use prepared statements
- **Rate limit**: Consider limits on expensive operations
- **Error messages**: Don't leak sensitive info in errors

### Secrets Management

- Never commit secrets to git
- Use `wrangler secret` for production
- Use `.dev.vars` for local development (git-ignored)
- Rotate secrets periodically
- Document which secrets are required

## 🚀 Deployment Process

### Before Deploying

1. **Test thoroughly locally**
2. **Review changes**: `git diff`
3. **Update version** in package.json (if major changes)
4. **Update documentation** if API changes
5. **Check TypeScript**: `npx tsc --noEmit`
6. **Build succeeds**: `npm run build`

### Deploy Steps

1. **Deploy Worker first**:
   ```bash
   npm run worker:deploy
   ```

2. **Test Worker** with curl or Postman

3. **Deploy Frontend**:
   ```bash
   npm run deploy
   ```

4. **Smoke test** production site

5. **Monitor logs** for first 10 minutes:
   ```bash
   npx wrangler tail
   ```

### Rollback if Needed

```bash
# Worker
npx wrangler rollback

# Pages: Use Cloudflare Dashboard → Pages → Deployments → Rollback
```

## 📚 Documentation

### When to Update Docs

- **New features**: Update README.md
- **API changes**: Update code comments and QUICK_REFERENCE.md
- **Breaking changes**: Update DEPLOYMENT.md
- **Config changes**: Update wrangler.toml comments

### Documentation Files

- **README.md**: User-facing, features, basic setup
- **DEPLOYMENT.md**: Detailed deployment instructions
- **QUICK_REFERENCE.md**: Command cheat sheet
- **PROJECT_SUMMARY.md**: Technical architecture
- **This file**: Contribution guidelines

## 🐛 Bug Reports

### Reporting Issues

Include:
1. What you expected to happen
2. What actually happened
3. Steps to reproduce
4. Environment (browser, OS)
5. Screenshots if UI-related
6. Console errors if applicable
7. Worker logs if backend-related

### Fixing Bugs

1. **Reproduce locally** first
2. **Identify root cause** (not just symptoms)
3. **Fix the issue**
4. **Test fix** thoroughly
5. **Add comments** explaining the fix
6. **Deploy to production**
7. **Monitor** for regression

## 🎨 Design Guidelines

### UI Principles

- **Minimal**: Don't add unnecessary elements
- **Consistent**: Follow existing patterns
- **Accessible**: Use semantic HTML and ARIA
- **Responsive**: Mobile-first approach
- **Fast**: Optimize images, lazy load

### Color Usage

- **Blue**: Primary actions, links
- **Purple**: Secondary accents
- **Green**: Success states
- **Yellow**: Warnings
- **Red**: Errors, destructive actions
- **Gray**: Neutral, text, borders

### Spacing

- Use Tailwind spacing scale: 1, 2, 3, 4, 6, 8, 12, 16
- Consistent padding: `p-4` or `p-6` for cards
- Gaps between elements: `space-x-3` or `gap-4`

## 🌟 Best Practices

### Performance

- Minimize API calls
- Use database indexes
- Implement pagination for large lists
- Lazy load images
- Debounce user inputs
- Cache static assets

### Error Handling

- Always use try-catch for async operations
- Log errors with context
- Show user-friendly error messages
- Don't expose internal errors
- Provide recovery actions

### Database

- Use transactions for multi-step operations
- Add indexes for foreign keys
- Clean up old data periodically
- Monitor query performance
- Plan for data growth

## 📦 Dependencies

### Adding New Dependencies

1. **Evaluate necessity**: Can you solve without it?
2. **Check bundle size**: Use Bundlephobia
3. **Check maintenance**: Is it actively maintained?
4. **Check license**: Compatible with MIT?
5. **Install**: `npm install package-name`
6. **Document usage**: Why was it added?

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update minor/patch versions
npm update

# Update major versions carefully
npm install package-name@latest

# Test thoroughly after updates
```

## 🤝 Community

### Ways to Contribute

1. **Report bugs**: Create detailed issues
2. **Suggest features**: Explain use cases
3. **Improve docs**: Fix typos, clarify instructions
4. **Write code**: Implement features or fixes
5. **Review code**: Provide feedback on changes
6. **Share**: Tell others about the project

### Communication

- Be respectful and constructive
- Provide context in discussions
- Stay on topic
- Help others when possible

## 📄 License

This project is MIT licensed. Contributions are welcome!

---

Thank you for contributing to WakaLead! 🎉
