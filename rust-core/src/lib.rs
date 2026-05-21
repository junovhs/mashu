use std::cell::RefCell;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Input types — mirror TypeScript SerializableEntry
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(tag = "kind")]
enum Entry {
    #[serde(rename = "file")]
    File(FileEntry),
    #[serde(rename = "folder")]
    Folder(FolderEntry),
}

impl Entry {
    fn path(&self) -> &str {
        match self {
            Entry::File(f) => &f.path,
            Entry::Folder(f) => &f.path,
        }
    }
    fn depth(&self) -> u32 {
        match self {
            Entry::File(f) => f.depth,
            Entry::Folder(f) => f.depth,
        }
    }
}

#[derive(Deserialize)]
struct FileEntry {
    name: String,
    path: String,
    size: u64,
    extension: String,
    depth: u32,
}

#[derive(Deserialize)]
struct FolderEntry {
    name: String,
    path: String,
    depth: u32,
}

// ---------------------------------------------------------------------------
// Output types — mirror TypeScript PureFolderInfo / PureFileInfo
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(untagged)]
enum PureNode {
    File(PureFileInfo),
    Folder(PureFolderInfo),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PureFileInfo {
    #[serde(rename = "type")]
    node_type: &'static str,
    name: String,
    path: String,
    size: u64,
    extension: String,
    depth: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PureFolderInfo {
    #[serde(rename = "type")]
    node_type: &'static str,
    name: String,
    path: String,
    depth: u32,
    children: Vec<PureNode>,
    file_count: u32,
    dir_count: u32,
    total_size: u64,
    file_types: HashMap<String, FileTypeStats>,
}

#[derive(Serialize, Default)]
struct FileTypeStats {
    count: u32,
    size: u64,
}

// ---------------------------------------------------------------------------
// Selection output — keyed by path, non-zero counts only
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SelectionResult {
    selected_subtree_counts: HashMap<String, u32>,
    selected_folder_paths: Vec<String>,
}

// ---------------------------------------------------------------------------
// Stateful tree index (retained between calls)
// ---------------------------------------------------------------------------

struct TreeIndex {
    subtree_counts: HashMap<String, u32>,
    children: HashMap<String, Vec<String>>,
    sorted_folders: Vec<String>, // depth-descending
}

thread_local! {
    static INDEX: RefCell<Option<TreeIndex>> = RefCell::new(None);
}

fn build_index(entries: &[Entry]) -> TreeIndex {
    // Initialize each node with count = 1 (itself).
    let mut subtree_counts: HashMap<String, u32> = entries
        .iter()
        .map(|e| (e.path().to_string(), 1u32))
        .collect();

    // Build direct-children map.
    let mut children: HashMap<String, Vec<String>> = HashMap::new();
    for e in entries {
        if let Some(parent) = parent_of(e.path()) {
            children
                .entry(parent.to_string())
                .or_default()
                .push(e.path().to_string());
        }
    }

    // Sort all entries depth-descending; bubble counts up to parents.
    let mut by_depth: Vec<(&str, u32)> = entries.iter().map(|e| (e.path(), e.depth())).collect();
    by_depth.sort_by(|a, b| b.1.cmp(&a.1));

    for (path, _) in &by_depth {
        let count = subtree_counts.get(*path).copied().unwrap_or(0);
        if let Some(parent) = parent_of(path) {
            *subtree_counts.entry(parent.to_string()).or_insert(0) += count;
        }
    }

    // Collect folder paths sorted depth-descending for bottom-up selection.
    let mut folder_depth: Vec<(String, u32)> = entries
        .iter()
        .filter(|e| matches!(e, Entry::Folder(_)))
        .map(|e| (e.path().to_string(), e.depth()))
        .collect();
    folder_depth.sort_by(|a, b| b.1.cmp(&a.1));
    let sorted_folders = folder_depth.into_iter().map(|(p, _)| p).collect();

    TreeIndex { subtree_counts, children, sorted_folders }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/// Returns the engine version string.
#[wasm_bindgen]
pub fn engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

/// Build a pure tree from a JSON array of SerializableEntry.
/// Returns the root PureFolderInfo as JSON, or "" on error.
#[wasm_bindgen]
pub fn build_tree_from_entries(entries_json: &str) -> String {
    let entries: Vec<Entry> = match serde_json::from_str(entries_json) {
        Ok(e) => e,
        Err(_) => return String::new(),
    };
    match build_pure_tree(&entries) {
        Some(tree) => serde_json::to_string(&tree).unwrap_or_default(),
        None => String::new(),
    }
}

/// Cache a tree index for subsequent compute_selection_state calls.
/// Returns true on success.
#[wasm_bindgen]
pub fn init_tree_index(entries_json: &str) -> bool {
    let entries: Vec<Entry> = match serde_json::from_str(entries_json) {
        Ok(e) => e,
        Err(_) => return false,
    };
    let index = build_index(&entries);
    INDEX.with(|i| *i.borrow_mut() = Some(index));
    true
}

/// Compute selection subtree counts from a JSON array of selected file paths.
/// Returns SelectionResult as JSON, or "" if no index is loaded.
#[wasm_bindgen]
pub fn compute_selection_state(selected_file_paths_json: &str) -> String {
    let selected: Vec<String> = match serde_json::from_str(selected_file_paths_json) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };
    INDEX.with(|i| {
        let guard = i.borrow();
        match &*guard {
            Some(index) => {
                let result = compute_selection(&selected, index);
                serde_json::to_string(&result).unwrap_or_default()
            }
            None => String::new(),
        }
    })
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

fn parent_of(path: &str) -> Option<&str> {
    path.rfind('/').map(|i| &path[..i])
}

fn build_pure_tree(entries: &[Entry]) -> Option<PureFolderInfo> {
    if entries.is_empty() {
        return None;
    }

    let mut folder_depth: Vec<(&str, u32)> = entries
        .iter()
        .filter(|e| matches!(e, Entry::Folder(_)))
        .map(|e| (e.path(), e.depth()))
        .collect();

    if folder_depth.is_empty() {
        return None;
    }

    folder_depth.sort_by(|a, b| b.1.cmp(&a.1));

    // Initialize folder nodes.
    let mut folders: HashMap<String, PureFolderInfo> = entries
        .iter()
        .filter_map(|e| {
            if let Entry::Folder(f) = e {
                Some((
                    f.path.clone(),
                    PureFolderInfo {
                        node_type: "folder",
                        name: f.name.clone(),
                        path: f.path.clone(),
                        depth: f.depth,
                        children: Vec::new(),
                        file_count: 0,
                        dir_count: 0,
                        total_size: 0,
                        file_types: HashMap::new(),
                    },
                ))
            } else {
                None
            }
        })
        .collect();

    // Attach files to parent folders.
    for e in entries {
        if let Entry::File(f) = e {
            if let Some(pp) = parent_of(&f.path) {
                if let Some(parent) = folders.get_mut(pp) {
                    parent.file_count += 1;
                    parent.total_size += f.size;
                    let st = parent.file_types.entry(f.extension.clone()).or_default();
                    st.count += 1;
                    st.size += f.size;
                    parent.children.push(PureNode::File(PureFileInfo {
                        node_type: "file",
                        name: f.name.clone(),
                        path: f.path.clone(),
                        size: f.size,
                        extension: f.extension.clone(),
                        depth: f.depth,
                    }));
                }
            }
        }
    }

    // Process folders deepest-first: move into parent.
    for (path, _) in &folder_depth {
        let child = match folders.remove(*path) {
            Some(c) => c,
            None => continue,
        };
        let parent_path = match parent_of(path) {
            Some(pp) => pp,
            None => {
                folders.insert(path.to_string(), child);
                continue;
            }
        };
        if let Some(parent) = folders.get_mut(parent_path) {
            parent.dir_count += 1 + child.dir_count;
            parent.file_count += child.file_count;
            parent.total_size += child.total_size;
            for (ext, st) in &child.file_types {
                let ps = parent.file_types.entry(ext.clone()).or_default();
                ps.count += st.count;
                ps.size += st.size;
            }
            parent.children.push(PureNode::Folder(child));
        } else {
            folders.insert(path.to_string(), child);
        }
    }

    folders.into_values().find(|f| f.depth == 0)
}

// ---------------------------------------------------------------------------
// Selection math
// ---------------------------------------------------------------------------

fn compute_selection(selected_file_paths: &[String], index: &TreeIndex) -> SelectionResult {
    let mut counts: HashMap<String, u32> = HashMap::new();

    // Seed: each selected file contributes 1.
    for path in selected_file_paths {
        counts.insert(path.clone(), 1);
    }

    let mut selected_folder_paths: Vec<String> = Vec::new();

    // Process folders bottom-up (deepest first).
    for folder_path in &index.sorted_folders {
        let total = index.subtree_counts.get(folder_path).copied().unwrap_or(0);
        let descendant_total = total.saturating_sub(1);

        let child_sum: u32 = index
            .children
            .get(folder_path.as_str())
            .map(|ch| {
                ch.iter()
                    .map(|c| counts.get(c.as_str()).copied().unwrap_or(0))
                    .sum()
            })
            .unwrap_or(0);

        if descendant_total > 0 && child_sum == descendant_total {
            counts.insert(folder_path.clone(), total);
            selected_folder_paths.push(folder_path.clone());
        } else if child_sum > 0 {
            counts.insert(folder_path.clone(), child_sum);
        }
    }

    SelectionResult {
        selected_subtree_counts: counts,
        selected_folder_paths,
    }
}
