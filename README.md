# Mashu

![Mashu Screenshot](screengrab.png)

Browser tool for selecting files and combining them into a single text export.

## What it does

- Drop a folder, see the full tree
- Select files/folders to include
- Export as a single text file (great for feeding to LLMs)
- Import AI-generated scaffolds and write them to disk
- Syntax-highlighted file preview

## Use cases

- Pack a codebase into one file for Claude/ChatGPT
- Generate project scaffolds from AI output
- Quick directory analysis without CLI tools

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Stack

- TypeScript
- Vite
- File System Access API
- CodeMirror (syntax highlighting)

## Notes

This started as vanilla HTML/JS in 2025. Refactored to TypeScript in 2026.

Uses Rust-style `Result<T, E>` and `Option<T>` patterns for error handling instead of try/catch.

## License

MIT
