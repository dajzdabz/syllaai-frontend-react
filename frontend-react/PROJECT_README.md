# SyllabAI Frontend (React)

Modern React + TypeScript frontend for SyllabAI - the AI-powered syllabus-to-calendar application.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **React Query** for server state management
- **Axios** for API calls
- **Google OAuth** for authentication

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (Auth, etc.)
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API and external services
├── types/          # TypeScript type definitions
└── utils/          # Helper functions
```

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and update values:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Migration Progress

- [x] Project setup with Vite + React + TypeScript
- [x] Folder structure established
- [x] API service with auth interceptors
- [x] TypeScript types defined
- [x] Auth context created
- [x] React Router configured
- [x] Basic page placeholders
- [ ] Google OAuth implementation
- [ ] Component migration from vanilla JS
- [ ] Styling system setup
- [ ] Full feature parity with legacy frontend

## Key Differences from Legacy Frontend

1. **Component-based architecture** - No more 2,900-line HTML file
2. **Type safety** - TypeScript catches errors at compile time
3. **Modern state management** - React Query for server state, Context for auth
4. **Better developer experience** - Hot module replacement, better debugging
5. **Maintainable code** - Clear separation of concerns, reusable components