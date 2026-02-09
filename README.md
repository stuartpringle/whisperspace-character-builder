# Whisperspace Character Builder

Web-based character builder powered by the Whisperspace rules API.

## Flow

1. Basics
2. Attributes
3. Skills
4. Gear
5. Review

## Persistence

- Auto-saves to localStorage as a draft.
- Export/Import JSON for manual backups.
- Cloud sync via `https://rules-api.whisperspace.com/character-api`.

## Build

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Hosting
- Target: `https://builder.whisperspace.com/`
- Build output: `dist/`
- Deploy model: build from this project directory and serve the `dist/` folder directly.

## Notes

- Uses `@whisperspace/sdk` for API access.
