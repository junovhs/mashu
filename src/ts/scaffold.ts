import { formatBytes, writeFile } from "./filesystem.js";
import { elements } from "./state.js";
import type { ParsedFile } from "./types/index.js";
import {
  resetUIForProcessing,
  showFailedUI,
  showNotification,
} from "./ui/index.js";
import { Err, Ok, type Result, toResult } from "./utils/result.js";

export const SCAFFOLD_PROMPT_TEMPLATE = `
Please act as a project scaffolder. I need a JSON object with two main keys:
1.  "structureString": A string representing the directory structure using parentheses for nesting and commas for siblings.
    Example: "myWebApp(index.html, css(styles.css), js(app.js))"
2.  "fileContents": An array of objects, where each object has "filePath" and "content".
    Example: [{ "filePath": "myWebApp/index.html", "content": "..." }]

My project description:
[DESCRIBE YOUR PROJECT HERE]

Your JSON response:
`;

export async function processScaffold(
  verifyAndProcess: (h: FileSystemDirectoryHandle) => Promise<void>,
) {
  const json = elements.aiScaffoldJsonInput.value.trim();
  if (!json) return showNotification("JSON empty.", 3000);

  const res = parseScaffold(json);
  if (!res.ok) return showNotification(`Invalid: ${res.error.message}`, 4000);

  const data = res.value;
  if (!(await checkSize(data))) return;

  const dest = await toResult(
    window.showDirectoryPicker({ id: "scaffoldDest", mode: "readwrite" }),
  );
  if (!dest.ok) return;

  elements.scaffoldImportModal.style.display = "none";
  resetUIForProcessing("Writing...");
  await buildScaffold(
    dest.value as FileSystemDirectoryHandle,
    data,
    verifyAndProcess,
  );
}

async function checkSize(data: { fileContents: Array<{ content: string }> }) {
  const size = data.fileContents.reduce(
    (s: number, f: { content: string }) => s + (f.content?.length || 0),
    0,
  );
  if (
    size > 50 * 1024 * 1024 &&
    !confirm(`Large scaffold (${formatBytes(size)}). Proceed?`)
  )
    return false;
  return true;
}

async function buildScaffold(
  dest: FileSystemDirectoryHandle,
  data: {
    structureString: string;
    fileContents: Array<ParsedFile>;
  },
  v: (h: FileSystemDirectoryHandle) => Promise<void>,
) {
  try {
    const name = data.structureString.split("(")[0].trim();
    for (const file of data.fileContents) {
      await writeFile(dest, file.filePath, file.content);
    }
    const root = await dest.getDirectoryHandle(name);
    showNotification(`Scaffold "${name}" written!`, 3000);
    await v(root);
  } catch (err) {
    console.error("Scaffold error:", err);
    showFailedUI("Scaffold failed.");
  }
}

function parseScaffold(
  json: string,
): Result<{ structureString: string; fileContents: ParsedFile[] }> {
  try {
    const data = JSON.parse(json);
    if (
      typeof data.structureString !== "string" ||
      !Array.isArray(data.fileContents)
    ) {
      return Err(new Error("Invalid format"));
    }
    return Ok(data);
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}
