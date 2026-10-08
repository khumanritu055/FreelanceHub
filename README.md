# FreelanceHub - Mini Freelance Marketplace

**Stack:** HTML, CSS, JavaScript, Bootstrap 5, Node.js (Express), SQLite database

## How to run
1. Install Node.js (v18 or newer).
2. Open a terminal in this folder and run: `npm install`
3. Start the app: `npm start`
4. Open http://localhost:3000 in your browser.

The database file `freelancehub.db` is created automatically on first run.

## Features
- Sign up / log in with two roles: **client** and **freelancer** (passwords are hashed with bcrypt)
- Client: post a gig, see all proposals, hire one freelancer, delete a gig
- Freelancer: browse and search gigs, filter by category, send one proposal per gig, track proposal status
- When a client hires, the chosen proposal becomes *accepted*, the others become *rejected*, and the gig becomes *hired*

## Database tables
| Table | Main columns |
|---|---|
| users | id, name, email (unique), password (hash), role, skills |
| gigs | id, client_id (FK), title, description, category, budget, status, created_at |
| proposals | id, gig_id (FK), freelancer_id (FK), message, price, status, created_at, UNIQUE(gig_id, freelancer_id) |

Relationships: one client has many gigs; one gig has many proposals; one freelancer sends many proposals.

## Folder structure
```
FreelanceHub/
  server.js        Express server, database setup, all API routes
  package.json
  public/
    index.html     Single page with Bootstrap modals
    style.css      Custom theme
    app.js         Frontend logic (fetch API calls, rendering)
```

## API routes
| Method | Route | Who |
|---|---|---|
| POST | /api/register, /api/login, /api/logout | everyone |
| GET | /api/me | everyone |
| GET | /api/gigs?q=&category= | everyone |
| POST | /api/gigs | client |
| DELETE | /api/gigs/:id | client (owner) |
| GET | /api/gigs/:id/proposals | client (owner) |
| POST | /api/gigs/:id/proposals | freelancer |
| POST | /api/proposals/:id/accept | client (owner) |
| GET | /api/dashboard | logged-in user |

## Viva points
- Why SQLite: no separate server to install, a single file database, still full SQL with foreign keys.
- Security: bcrypt password hashing, session login, role checks on every protected route, parameterised SQL queries (prevents SQL injection), HTML escaping on the frontend (prevents XSS).
- Hiring uses a database transaction so the three updates succeed or fail together.

## Future scope
Payments, chat between client and freelancer, reviews and ratings, file attachments, email notifications.
