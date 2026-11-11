//! Stable opaque identifiers for edge cache keys

use sha2::{Digest, Sha256};

pub(crate) fn short_hash(value: &[u8]) -> String {
    let digest = Sha256::digest(value);
    hex(&digest[..16])
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::short_hash;

    #[test]
    fn identifiers_are_stable_and_do_not_expose_input() {
        assert_eq!(short_hash(b"same"), short_hash(b"same"));
        assert_ne!(short_hash(b"same"), short_hash(b"different"));
        assert!(!short_hash(b"private value").contains("private"));
    }
}
