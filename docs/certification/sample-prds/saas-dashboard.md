# SaaS Analytics Dashboard PRD

**Complexity Tier:** Standard (3-10 files, features with auth and database)

## Overview

A web-based analytics dashboard for a SaaS product. Users can sign up, log in, view charts of their usage metrics, and manage their account settings.

## Requirements

### Authentication
- Email/password registration with bcrypt hashing
- Login with JWT token issuance
- Protected routes requiring valid JWT
- Password reset flow (email-based)

### Dashboard
- Overview page with key metrics (active users, revenue, API calls)
- Line chart showing daily active users over 30 days
- Bar chart showing API call volume by endpoint
- Date range selector for filtering data

### API
- RESTful API with OpenAPI specification
- `POST /api/auth/register` -- Create account
- `POST /api/auth/login` -- Authenticate and receive JWT
- `GET /api/metrics/overview` -- Key metrics summary
- `GET /api/metrics/users?range=30d` -- User activity data
- `GET /api/metrics/api-calls?range=30d` -- API call data
- `GET /api/account` -- Account details
- `PUT /api/account` -- Update account settings

### Database
- PostgreSQL for persistent storage
- Users table (id, email, password_hash, created_at)
- Metrics table (id, user_id, metric_type, value, recorded_at)
- Database migrations for schema management

## Tech Stack

- **Frontend:** React with TypeScript, Tailwind CSS, Recharts for charts
- **Backend:** Node.js with Express, TypeScript
- **Database:** PostgreSQL with Knex.js for migrations
- **Auth:** bcrypt + JWT

## Non-Functional Requirements

- API response time < 200ms for all endpoints
- Frontend loads in < 3 seconds on 3G connection
- Unit test coverage > 80%
- Integration tests for auth flow and API endpoints
- OWASP Top 10 compliance (SQL injection prevention, XSS protection, CSRF tokens)

## Success Criteria

- User can register, log in, and view dashboard
- Charts render with sample data
- All API endpoints match OpenAPI spec
- Unit and integration tests pass
- No Critical or High security findings in review
