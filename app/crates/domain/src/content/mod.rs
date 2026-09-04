pub mod authoring;
pub mod export;
pub mod import;
pub mod manifest;
pub mod repository;
pub mod resolver;
pub mod ruleset;
pub mod search;
mod schemas;
pub(crate) mod zip_safety;

/// The PTU content kinds a `.ptucp` pack can carry, each backed by its own
/// SQLite table (technical spec section 23).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ContentKind {
    Move,
    Ability,
    Capability,
    Edge,
    PokeEdge,
    Feature,
    Item,
    Species,
    Shop,
}

impl ContentKind {
    pub fn table_name(self) -> &'static str {
        match self {
            ContentKind::Move => "moves",
            ContentKind::Ability => "abilities",
            ContentKind::Capability => "capabilities",
            ContentKind::Edge => "edges",
            ContentKind::PokeEdge => "poke_edges",
            ContentKind::Feature => "features",
            ContentKind::Item => "items",
            ContentKind::Species => "species",
            ContentKind::Shop => "shops",
        }
    }

    /// Maps a `content/<stem>.ndjson` file stem (per the `.ptucp` layout in
    /// technical spec 22.1) to its content kind.
    pub fn from_file_stem(stem: &str) -> Option<Self> {
        match stem {
            "moves" => Some(ContentKind::Move),
            "abilities" => Some(ContentKind::Ability),
            "capabilities" => Some(ContentKind::Capability),
            "edges" => Some(ContentKind::Edge),
            "poke_edges" => Some(ContentKind::PokeEdge),
            "features" => Some(ContentKind::Feature),
            "items" => Some(ContentKind::Item),
            "species" => Some(ContentKind::Species),
            "shops" => Some(ContentKind::Shop),
            _ => None,
        }
    }

    /// Singular slug used in `"<kind>:<logical_id>"` definition references
    /// (test vectors, ruleset `version_pins` keys), e.g. `"ability"`.
    pub fn kind_slug(self) -> &'static str {
        match self {
            ContentKind::Move => "move",
            ContentKind::Ability => "ability",
            ContentKind::Capability => "capability",
            ContentKind::Edge => "edge",
            ContentKind::PokeEdge => "poke_edge",
            ContentKind::Feature => "feature",
            ContentKind::Item => "item",
            ContentKind::Species => "species",
            ContentKind::Shop => "shop",
        }
    }

    pub fn from_kind_slug(slug: &str) -> Option<Self> {
        match slug {
            "move" => Some(ContentKind::Move),
            "ability" => Some(ContentKind::Ability),
            "capability" => Some(ContentKind::Capability),
            "edge" => Some(ContentKind::Edge),
            "poke_edge" => Some(ContentKind::PokeEdge),
            "feature" => Some(ContentKind::Feature),
            "item" => Some(ContentKind::Item),
            "species" => Some(ContentKind::Species),
            "shop" => Some(ContentKind::Shop),
            _ => None,
        }
    }
}

/// Parses a `"<kind_slug>:<logical_id>"` definition reference, e.g.
/// `"ability:abominable"`, as used by ruleset `version_pins` and the
/// content-resolver test vectors.
pub fn parse_definition_ref(reference: &str) -> Option<(ContentKind, &str)> {
    let (kind_str, logical_id) = reference.split_once(':')?;
    let kind = ContentKind::from_kind_slug(kind_str)?;
    Some((kind, logical_id))
}
