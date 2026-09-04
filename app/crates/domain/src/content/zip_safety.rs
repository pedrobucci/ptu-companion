/// Rejects zip entry names that could escape an extraction root (ZIP-slip /
/// path traversal), per technical spec section 27. Applied to every entry in
/// an archive before anything is read from it.
pub fn is_safe_entry_path(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    if name.starts_with('/') || name.starts_with('\\') {
        return false;
    }
    // Windows drive-letter absolute path, e.g. "C:\...".
    let bytes = name.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        return false;
    }
    for component in name.split(['/', '\\']) {
        if component == ".." {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_normal_relative_paths() {
        assert!(is_safe_entry_path("manifest.json"));
        assert!(is_safe_entry_path("content/moves.ndjson"));
        assert!(is_safe_entry_path("content/datasets/damage_chart.json"));
    }

    #[test]
    fn rejects_parent_traversal() {
        assert!(!is_safe_entry_path("../evil.txt"));
        assert!(!is_safe_entry_path("content/../../evil.txt"));
        assert!(!is_safe_entry_path("content/../../../etc/passwd"));
    }

    #[test]
    fn rejects_absolute_paths() {
        assert!(!is_safe_entry_path("/etc/passwd"));
        assert!(!is_safe_entry_path("\\Windows\\System32\\evil.dll"));
        assert!(!is_safe_entry_path("C:\\Windows\\System32\\evil.dll"));
    }

    #[test]
    fn rejects_empty_path() {
        assert!(!is_safe_entry_path(""));
    }
}
