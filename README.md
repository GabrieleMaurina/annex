# annex
Strategy Multiplayer War Game

**annex** /ænˈeks/ *(verb)* : to take possession of an area of land or a country, usually by force or without permission


### Running

Install [Node.js](https://nodejs.org/en/download "Node.js")

Install all dependencies once from the repo root:

```bash
npm i
```

Build `engine` (the server imports its compiled output, so this must run first, and again after changing `engine`):

```bash
cd engine/
npm run build
```

```bash
cd server/
npm run dev
```

```bash
cd client/
npm run dev
```
