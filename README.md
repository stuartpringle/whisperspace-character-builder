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
- Planned: server-side storage.

## Build

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Notes

- Uses `@whisperspace/sdk` for API access.
- Intended to be hosted at `https://whisperspace.com/character-builder`.
