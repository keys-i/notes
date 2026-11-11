//! Bounded study-chat primitives and the Cloudflare Worker entry point
//!
//! The public helpers keep validation, retrieval, routing and grounded output independently testable
//!
//! ```
//! use notes_pet::{InputClass, classify_input};
//!
//! assert_eq!(classify_input("How does momentum change?"), InputClass::Allowed);
//! ```

mod routing;
mod service;
mod shared;

pub use service::koala::*;
