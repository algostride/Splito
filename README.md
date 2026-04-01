# Splito - Splitwise Alternative MVP

Splito is a modern, responsive web application for creating groups, logging shared bills, and magically determining who owes who through recursive balance computation. 

## Tech Stack
- **Backend**: Django 5, Django REST Framework, PostgreSQL, SimpleJWT
- **Frontend**: React 18, Vite, Redux Toolkit (RTK Query), Tailwind CSS

## Feature Set
1. **Secure Authentication**: JWT-session token management and secure registration via API.
2. **Groups & Memberships**: Create isolated groups for friends, events, or trips.
3. **Advanced Invites**: Interoperable one-click ticket URLs to invite members securely.
4. **Intelligent Bills**: Add bills manually assigning portions or evenly splitting them with group members.
5. **Real-time Settlement Engine**: Automatically computes net balances in backend to simplify debts cleanly inside the active group context.
6. **OCR Bill Addition**: Add bills using OCR to extract information from the bill. In progress.

## Local Setup

### Backend
1. `cd backend`
2. `python -m venv venv && source venv/bin/activate`
3. `pip install -r requirements.txt`
4. Create `.env` from `.env.example` to link PostgreSQL.
5. `python manage.py migrate`
6. `python manage.py runserver`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Navigate to `http://localhost:5173` to experience Splito.
