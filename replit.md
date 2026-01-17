# Shinra OS - License & Script Management Platform

## Overview

Shinra OS is a full-stack license management and script distribution platform designed for Roblox script hubs. It provides administrators with tools to manage software products, generate and track license keys, enforce HWID (Hardware ID) binding, maintain ban lists, and monitor script execution logs. The platform features a dark, industrial-themed UI with neon red/purple accents.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite with custom path aliases (@/, @shared/, @assets/)
- **Theme**: Custom dark theme with CSS variables (industrial aesthetic)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints defined in shared/routes.ts with Zod validation
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)
- **Authentication**: Replit OpenID Connect integration with Passport.js

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: shared/schema.ts (shared between frontend/backend)
- **Migrations**: drizzle-kit with migrations stored in /migrations

### Key Data Models
- **Users**: Replit Auth user storage (id, email, profile info)
- **Products**: Software products with versioning and tier system
- **Licenses**: License keys with HWID binding and expiration
- **Scripts**: Source code associated with products
- **HWID Bans**: Hardware ID blacklist
- **Execution Logs**: Audit trail of script load attempts

### Authentication Flow
- Replit OpenID Connect handles user authentication
- Sessions stored in PostgreSQL using connect-pg-simple
- Protected routes use isAuthenticated middleware
- Frontend checks auth state via /api/auth/user endpoint

### API Structure
Routes are defined declaratively in shared/routes.ts with:
- Path definitions
- HTTP methods
- Zod input/output schemas
- Shared between client and server for type safety

## External Dependencies

### Authentication
- **Replit Auth**: OpenID Connect provider for user authentication
- **Passport.js**: Authentication middleware with openid-client strategy

### Database
- **PostgreSQL**: Primary database (requires DATABASE_URL environment variable)
- **connect-pg-simple**: Session storage in PostgreSQL

### UI Components
- **shadcn/ui**: Radix-based component library (new-york style)
- **Recharts**: Dashboard analytics and data visualization
- **Lucide React**: Icon library

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Express session secret (required)
- `ISSUER_URL`: Replit OIDC issuer (defaults to https://replit.com/oidc)
- `REPL_ID`: Replit environment identifier

### Build & Development
- **Vite**: Frontend bundling with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development
