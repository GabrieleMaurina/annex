# annex
Strategy Multiplayer War Game

**annex** /ænˈeks/ *(verb)* : to take possession of an area of land or a country, usually by force or without permission


### Play

[annexgame.com](https://annexgame.com)


### Run Locally

Install [Node.js](https://nodejs.org/en/download "Node.js")

Install all dependencies once from the repo root:

```bash
npm i
```

Install and run [MongoDB](https://www.mongodb.com/docs/manual/installation/) locally on the default port `27017`.

Set these environment variables for the server:

- `MONGO_USER`, `MONGO_PASS` - MongoDB credentials (omit both to connect without auth)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` - SMTP server settings, optional; if not all set, no emails are sent

Run the server and client in separate terminals:

```bash
cd server/
npm run dev
```

```bash
cd client/
npm run dev
```
