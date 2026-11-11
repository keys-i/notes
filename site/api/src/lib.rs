//! Bounded study-chat primitives and the Cloudflare Worker entry point
//!
//! The public helpers keep validation, retrieval, routing and grounded output independently testable
//!
//! ```
//! use notes_pet::{InputClass, classify_input};
//!
//! assert_eq!(classify_input("How does momentum change?"), InputClass::Allowed);
//! ```

mod answer;
mod attachment;
mod cache;
mod input;
mod media;
mod model;
mod ops;
mod prompt;
mod retrieval;
mod study;
mod worker;

pub use cache::*;
pub use input::*;
pub use prompt::*;
pub use retrieval::*;
pub use study::*;
