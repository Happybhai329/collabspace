# 📦 CollabSpace — Real-Time Collaborative Workspace

> A high-performance, enterprise-ready Agile Project Management and Team Collaboration Platform built with modern Node.js, Express, MongoDB, and Redis.

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19+-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7+-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Zod](https://img.shields.io/badge/Zod-Validated-3E67B1?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#️-tech-stack)
- [Database Schema Design](#-database-schema-design)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Security Architecture](#-security-architecture)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#️-installation--setup)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [API Reference](#-api-reference)
- [Docker Deployment](#-docker-deployment)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## 🌟 Overview

**CollabSpace** is a production-grade, real-time collaborative workspace engineered for agile software teams. Combining the board versatility of Trello, the issue-tracking depth of Jira, and the collaborative ergonomics of modern developer platforms, CollabSpace enables distributed engineering teams to manage workspaces, projects, sprint boards, and tasks with sub-millisecond real-time sync.

The architecture emphasizes **Clean Architecture**, separation of concerns, zero placeholder code, and defensive security posture—built on ES Modules in modern Node.js.

---

## 🚀 Key Features

- **Multi-Tenant Workspaces & Projects**: Organize organizations into isolated workspaces with custom URL slugs, membership tiers, and Jira-style project counters (e.g. `PROJ-101`).
- **Flexible Kanban & Scrum Workflows**: Dynamic boards featuring custom columns, configurable WIP (Work-in-Progress) limits, status mapping, and $O(1)$ reordering arrays (`columnOrder`, `taskOrder`).
- **Real-Time Collaboration**: Real-time bi-directional events via Socket.io with pub/sub architecture readiness for horizontal scale.
- **Hierarchical Task & Subtask Management**: Full task lifecycle support including self-referential subtasks, priority levels, labels, due dates, and virtual identifiers.
- **Discussions & Activity Feeds**: Rich task commenting with soft deletion, edit tracking, emoji reactions, and `@mentions`.
- **Automated Lifecycle Notifications**: Notification engine with MongoDB TTL (Time-To-Live) indexes that auto-expire read notifications after 30 days.
- **Immutable Audit Trail**: Granular activity logs tracking actors, actions, target entities, and exact before-and-after field diffs.
- **Enterprise-Grade Authentication**: Stateless dual-token authentication (Access + Refresh tokens) utilizing rotating tokens, bcrypt hashing in storage, and instant Redis token revocation.

---

## 🏗️ System Architecture

CollabSpace strictly enforces **Clean Layered Architecture** to separate HTTP concerns from core business domains:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React / Vite)                    │
└──────────────┬───────────────────────────────┬──────────────┘
               │ HTTP / REST                   │ WebSockets
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│     Express Application      │ │     Socket.io Gateway       │
│  (Helmet, CORS, Sanitizers)  │ │      (Real-Time Sync)       │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               │
               ▼                               │
┌──────────────────────────────┐               │
│         Route Layer          │               │
└──────────────┬───────────────┘               │
               ▼                               │
┌──────────────────────────────┐               │
│       Middleware Layer       │               │
│ (Auth, Validate, Rate-Limit) │               │
└──────────────┬───────────────┘               │
               ▼                               │
┌──────────────────────────────┐               │
│       Controller Layer       │               │
│     (Request / Response)     │               │
└──────────────┬───────────────┘               │
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Service Layer                        │
│             (Pure Business Logic, Domain Rules)             │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│      Mongoose ODM Layer      │ │      Redis Cache Layer      │
│  (Models, Hooks, Indexes)    │ │ (Blocklist, PubSub, Limit)  │
└──────────────┬───────────────┘ └─────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│       MongoDB Database       │ │        Redis Server         │
└──────────────────────────────┘ └─────────────────────────────┘
```

### Architectural Highlights
- **Thin Controllers**: Dedicated exclusively to parsing request input and delegating to domain services.
- **Decoupled Services**: Business operations remain completely agnostic of HTTP protocols, ensuring effortless unit testing.
- **Application Factory Pattern**: `createApp()` decouples application configuration from network listening (`server.js`), allowing concurrent test execution without port collisions.
- **Graceful Shutdown**: Intercepts `SIGTERM` and `SIGINT` signals, rejects incoming HTTP requests, drains pending operations, and gracefully disconnects database and Redis connections with a 30-second fallback safeguard.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | [Node.js](https://nodejs.org/) (v20+) | High-performance asynchronous JavaScript runtime (ES Modules) |
| **Framework** | [Express.js](https://expressjs.com/) (v4.19) | Minimalist web application and REST routing framework |
| **Database** | [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) (v8.4) | Document database with rigid schemas, indexes, and lifecycle hooks |
| **In-Memory Store** | [Redis](https://redis.io/) + [ioredis](https://github.com/redis/ioredis) (v5.4) | High-speed caching, token blacklisting, rate limiting & Pub/Sub |
| **Real-Time** | [Socket.io](https://socket.io/) (v4.7) | Bi-directional, low-latency WebSocket communication |
| **Authentication** | [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Dual-token authentication with salted password hashing |
| **Validation** | [Zod](https://zod.dev/) (v3.23) | Type-safe schema validation for request payloads |
| **Logging** | [Winston](https://github.com/winstonjs/winston) + [Morgan](https://github.com/expressjs/morgan) | Structured JSON logging with daily log file rotation |
| **Security** | [Helmet](https://helmetjs.github.io/), CORS, HPP, Mongo-Sanitize | Defense-in-depth against XSS, NoSQL injection, and parameter pollution |
| **Containerization** | [Docker](https://www.docker.com/) | Production-ready multi-stage container deployment |

---

## 🗄️ Database Schema Design

CollabSpace utilizes 10 interconnected MongoDB collections designed with strict indexes and optimization strategies:

| Collection | Schema Highlights & Key Design Decisions |
|---|---|
| `users` | Hidden password by default (`select: false`), pre-save bcrypt hash hook, refresh tokens array, email uniqueness index. |
| `workspaces` | URL-safe slug generation, denormalized `memberCount`, ownership tracking. |
| `workspace_members` | Compound unique index `{ workspace, user }` preventing duplicate memberships; role escalation safeguards. |
| `projects` | Jira-style uppercase short key (e.g., `CORE`, `MOBILE`) with atomic incrementing `taskCounter`. |
| `boards` | Dynamic column sequencing via `columnOrder: [ObjectId]` for fast drag-and-drop mutations. |
| `columns` | Task sequencing via `taskOrder: [ObjectId]`, WIP (Work In Progress) constraints, and status association. |
| `tasks` | Self-referential subtasks, compound virtual identifiers (`PROJ-101`), priority flags, assignee, and label tagging. |
| `comments` | Soft deletion (`isDeleted`), full revision history, nested emoji reactions, and `@username` mention detection. |
| `notifications` | Automatic MongoDB TTL expiration deleting read notifications after 30 days (`expireAfterSeconds: 2592000`). |
| `activity_logs` | Append-only audit trail capturing Actor, Action, Entity, and granular before/after diffs. |

---

## 👥 Role-Based Access Control (RBAC)

Every workspace member is assigned a hierarchical role with granular access permissions:

```
Owner (Level 5) ──► Admin (Level 4) ──► Manager (Level 3) ──► Developer (Level 2) ──► Viewer (Level 1)
```

| Role | Hierarchy Level | Capabilities |
|---|:---:|---|
| **Owner** | `5` | Full administrative control, billing, workspace deletion, ownership transfer. |
| **Admin** | `4` | Manage workspace settings, invite/remove members, manage roles, create projects. |
| **Manager** | `3` | Create and configure projects, manage boards, create/assign tasks, modify sprints. |
| **Developer** | `2` | Create tasks, update assigned tasks, post comments, update task statuses. |
| **Viewer** | `1` | Read-only access to boards, tasks, comments, and project dashboards. |

---

## 🔒 Security Architecture

CollabSpace incorporates enterprise security standards out of the box:

- **14 HTTP Security Headers**: Helmet automatically configures HTTP Strict Transport Security (HSTS), Content Security Policy (CSP), X-Frame-Options, and X-Content-Type-Options.
- **NoSQL Injection Defense**: `express-mongo-sanitize` intercepts input bodies, params, and queries to strip `$` and `.` characters, logging suspicious attempts.
- **HTTP Parameter Pollution (HPP)**: `hpp` middleware guards against repeated query parameters designed to bypass validation checks.
- **Dual-Token JWT Flow**:
  - **Access Token**: Short-lived (15 minutes), signed with HMAC SHA-256.
  - **Refresh Token**: Long-lived (7 days), stored in `httpOnly`, `SameSite` cookies inaccessible to client-side scripts (XSS-safe).
  - **Database Defense**: Stored refresh tokens are bcrypt-hashed in MongoDB; compromised databases cannot yield valid active sessions.
  - **Immediate Revocation**: Logout operations immediately add the token JTI to a Redis blocklist.
- **Three-Tier Rate Limiting**:
  - `Global Limiter`: 100 requests / 15 minutes per IP.
  - `Auth Limiter`: 10 requests / 15 minutes for login & register.
  - `Sensitive Limiter`: 5 requests / hour for sensitive credential modifications.
- **Password Enforcement**: Zod validation requiring at least 8 characters, uppercase, lowercase, numeric, and special character criteria.

---

## 📂 Project Structure

```
collabspace/
├── backend/
│   ├── .dockerignore
│   ├── .env.example              # Environment configuration template
│   ├── Dockerfile                # Multi-stage production container build
│   ├── package.json              # Dependencies and scripts (ES Modules)
│   ├── package-lock.json
│   ├── server.js                 # Network entrypoint & graceful shutdown
│   └── src/
│       ├── app.js                # Express app factory & middleware stack
│       ├── config/
│       │   ├── database.js       # MongoDB Mongoose connection & events
│       │   ├── env.config.js     # Validated environment configuration
│       │   ├── logger.js         # Winston logger configuration
│       │   └── redis.js          # ioredis client instance & events
│       ├── constants/
│       │   ├── enums.js          # System enums (Task Status, Priority, etc.)
│       │   └── roles.js          # RBAC roles and permission levels
│       ├── middleware/
│       │   ├── auth.middleware.js         # JWT verification & RBAC guard
│       │   ├── errorHandler.middleware.js # Standardized error formatter
│       │   ├── rateLimiter.middleware.js  # Tiered IP rate limiting
│       │   └── validate.middleware.js     # Zod request validation wrapper
│       ├── models/
│       │   ├── ActivityLog.model.js       # Immutable audit log
│       │   ├── Board.model.js             # Kanban board model
│       │   ├── Column.model.js            # Board columns & WIP limits
│       │   ├── Comment.model.js           # Rich task comments & reactions
│       │   ├── Notification.model.js      # TTL-indexed notification schema
│       │   ├── Project.model.js           # Jira-style project model
│       │   ├── Task.model.js              # Issue & task schema
│       │   ├── User.model.js              # User authentication schema
│       │   ├── Workspace.model.js         # Organization/workspace schema
│       │   └── WorkspaceMember.model.js   # Membership & role junction
│       ├── modules/
│       │   └── auth/
│       │       ├── auth.controller.js     # HTTP request handlers
│       │       ├── auth.routes.js         # Auth endpoint definitions
│       │       ├── auth.service.js        # Core authentication logic
│       │       └── auth.validation.js     # Zod schemas for auth inputs
│       └── utils/
│           ├── ApiError.js       # Operational domain error class
│           ├── ApiResponse.js    # Uniform JSON response envelope
│           └── asyncWrapper.js   # Try/catch controller wrapper
├── .gitattributes
├── .gitignore
└── README.md
```

---

## 📋 Prerequisites

Ensure your development environment meets the following specifications:

- **Node.js**: `v20.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: `v6.0+` (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Redis**: `v7.0+` (local instance or [Upstash Redis](https://upstash.com/))
- **Docker**: (Optional) For containerized execution

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Happybhai329/collabspace.git
cd collabspace/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Duplicate the template and update values:

```bash
cp .env.example .env
```

Generate cryptographically secure 64-byte secret keys:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Update your `.env` with the generated keys for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

---

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `NODE_ENV` | Yes | `development` | Environment mode (`development` / `production` / `test`) |
| `PORT` | No | `5000` | Port on which Express server will listen |
| `API_VERSION` | No | `v1` | URL prefix for versioned endpoints |
| `MONGO_URI` | Yes | `mongodb://localhost:27017/collabspace` | MongoDB connection string |
| `REDIS_HOST` | No | `localhost` | Redis server hostname |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | `""` | Redis authentication password (if applicable) |
| `REDIS_URL` | No | — | Full Redis URI (takes priority if provided, e.g. Upstash) |
| `JWT_ACCESS_SECRET` | Yes | — | 64-byte hex secret key for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | — | 64-byte hex secret key for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Lifetime duration for access tokens |
| `JWT_REFRESH_EXPIRES_IN`| No | `7d` | Lifetime duration for refresh tokens |
| `COOKIE_DOMAIN` | No | `localhost` | Domain scope for session cookies |
| `COOKIE_SECURE` | No | `false` | Enable `Secure` flag for HTTPS environments |
| `CORS_ORIGINS` | Yes | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed client origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 mins) | Time frame window for rate limiting |
| `RATE_LIMIT_MAX_REQUESTS`| No | `100` | Max requests allowed per window per IP |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Cost factor for password hashing |
| `LOG_LEVEL` | No | `debug` | Minimum logging level (`debug`, `info`, `warn`, `error`) |

---

## 🏃 Running the Application

### Development Mode
Runs the application with hot-reloading using `nodemon`:

```bash
npm run dev
```

### Production Mode
Executes the optimized production server:

```bash
npm start
```

### Code Quality & Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

---

## 📡 API Reference

All responses strictly follow the standard JSON envelope structure:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully.",
  "data": {}
}
```

### Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/health` | Public | System status, timestamp, and environment |
| `POST` | `/api/v1/auth/register` | Public | Register a new user account |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user and receive tokens |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and issue new access token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke tokens and clear cookies |
| `GET` | `/api/v1/auth/me` | Authenticated | Fetch profile of authenticated user |

#### Example: Register a New User

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alex",
    "lastName": "Rivera",
    "username": "alexrivera",
    "email": "alex@example.com",
    "password": "SecurePassword123!",
    "confirmPassword": "SecurePassword123!"
  }'
```

#### Example: Validation Error Response

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    }
  ]
}
```

---

## 🐳 Docker Deployment

A multi-stage Docker build is included for containerized environments.

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t collabspace-backend:latest ./backend

# Run the container
docker run -d \
  --name collabspace-api \
  -p 5000:5000 \
  --env-file ./backend/.env \
  collabspace-backend:latest
```

---

## 🤝 Contributing

Contributions are welcome! Follow these steps to contribute:

1. **Fork** the repository.
2. **Create a branch**: `git checkout -b feature/amazing-feature`.
3. **Commit your changes**: `git commit -m 'feat: Add amazing feature'`.
4. **Push to branch**: `git push origin feature/amazing-feature`.
5. **Open a Pull Request**.

Please ensure your code passes `npm run lint` and aligns with existing Clean Architecture patterns before submitting.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more information.

---

## 👤 Author

**Happybhai329**
- GitHub: [@Happybhai329](https://github.com/Happybhai329)
