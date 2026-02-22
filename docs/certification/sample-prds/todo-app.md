# Todo App PRD

**Complexity Tier:** Simple (1-2 files, basic CRUD)

## Overview

A command-line todo application written in Node.js. No external dependencies, no database, no authentication.

## Requirements

### Functional
- Add a todo item with a title (string, max 200 characters)
- List all todo items with their status (pending/complete)
- Mark a todo item as complete by ID
- Delete a todo item by ID
- Each todo has: id (auto-generated UUID), title, status, createdAt timestamp

### Non-Functional
- Store todos in a local JSON file (`todos.json`)
- Data persists between runs
- CLI responds in under 100ms for all operations
- No external npm dependencies (use built-in `fs`, `crypto`, `path` modules)

## Tech Stack

- Node.js (built-in modules only)
- JSON file storage

## CLI Interface

```bash
todo add "Buy groceries"        # Add a new todo
todo list                       # List all todos
todo done <id>                  # Mark as complete
todo delete <id>                # Delete a todo
```

## Success Criteria

- All 4 CRUD operations work correctly
- Data persists in `todos.json` between runs
- Unit tests pass with >80% coverage
- No external dependencies in `package.json`
- Error handling for: missing title, invalid ID, file read/write failures
