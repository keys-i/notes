//! Cache-Control policies for static, dynamic and private responses

pub(crate) const MANUALS: &str = "public, max-age=86400, s-maxage=604800";
pub(crate) const NO_STORE: &str = "no-store";
pub(crate) const PAPERS: &str = "public, max-age=300, s-maxage=3600";
pub(crate) const PREFLIGHT: &str = "public, max-age=86400";
pub(crate) const PRIVATE: &str = "private, no-store";
pub(crate) const REFERENCE: &str = "public, max-age=300, s-maxage=3600";
pub(crate) const SHARED_REPLY: &str = "public, max-age=86400";
