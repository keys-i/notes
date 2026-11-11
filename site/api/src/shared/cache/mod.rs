//! Shared edge-cache access, key encoding and response policies

pub(crate) mod edge;
mod key;
pub(crate) mod policy;

pub(crate) use key::{hex, short_hash};
