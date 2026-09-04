//! PTU Companion domain/rules layer.
//!
//! This crate holds all PTU rules and application state logic and must stay
//! independent of Tauri so it can be unit-tested without a UI runtime.
//! Later tasks add modules here (ruleset resolver, trainer/pokemon
//! instances, modifier engine, etc.) per the technical specification.

pub mod content;
pub mod engine;
pub mod error;
pub mod persistence;
pub mod portability;
pub mod profile;

/// Domain crate version, exposed to the shell layer for diagnostics.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_not_empty() {
        assert!(!version().is_empty());
    }
}
