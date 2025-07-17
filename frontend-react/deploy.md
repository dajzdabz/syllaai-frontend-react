# Deployment Instructions

## GitHub Repository Setup

1. Create a new repository on GitHub:
   - Repository name: `syllaai-frontend-react`
   - Description: "Modern React + TypeScript frontend for SyllabAI - AI-powered syllabus to calendar application"
   - Public repository

2. Connect this local repository:
```bash
git remote add origin https://github.com/dajzdabz/syllaai-frontend-react.git
git branch -M main
git push -u origin main
```

## GitHub Pages Setup

1. Go to repository Settings > Pages
2. Source: Deploy from a branch
3. Branch: `main` / `docs` (or create a `gh-pages` branch)
4. Folder: `/dist`

## Alternative: GitHub Actions Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_API_URL: https://syllaai-ai.onrender.com
          VITE_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID_REMOVED
      
      - name: Setup Pages
        uses: actions/configure-pages@v3
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist
  
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

## Production URLs

- **Frontend**: https://dajzdabz.github.io/syllaai-frontend-react/
- **Backend API**: https://syllaai-ai.onrender.com
- **Repository**: https://github.com/dajzdabz/syllaai-frontend-react

## Environment Variables (Production)

Already configured in `.env.production`:
- `VITE_API_URL=https://syllaai-ai.onrender.com`
- `VITE_GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID_REMOVED`

## Next Steps After Deployment

1. Update Google OAuth settings to include the new domain
2. Test authentication flow
3. Monitor deployment in GitHub Actions
4. Update main project documentation with new URLs