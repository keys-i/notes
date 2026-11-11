//! Attachment decoding and signature validation at the request boundary

use super::input::{Attachment, AttachmentKind};

const MAX_ATTACHMENT_BYTES: usize = 2 * 1024 * 1024;

pub(crate) fn attachment_payload(attachment: &Attachment) -> Option<&str> {
    attachment
        .data_url
        .split_once(',')
        .map(|(_, payload)| payload)
}

pub(crate) fn attachment_audio_format(attachment: &Attachment) -> Option<&'static str> {
    let mime = attachment
        .data_url
        .strip_prefix("data:")?
        .split_once(';')?
        .0;
    match mime {
        "audio/aac" => Some("aac"),
        "audio/flac" => Some("flac"),
        "audio/mp4" | "audio/x-m4a" => Some("m4a"),
        "audio/mpeg" => Some("mp3"),
        "audio/ogg" => Some("ogg"),
        "audio/wav" | "audio/x-wav" => Some("wav"),
        "audio/webm" => Some("webm"),
        _ => None,
    }
}

pub(crate) fn decode_base64(payload: &str) -> Option<Vec<u8>> {
    let length = validate_base64(payload).ok()?;
    let output = decode_base64_prefix(payload, length)?;
    (output.len() == length).then_some(output)
}

pub(crate) fn validate_attachment(attachment: &Attachment) -> Result<(), &'static str> {
    let Some((metadata, payload)) = attachment.data_url.split_once(',') else {
        return Err("invalid attachment");
    };
    let Some(mime) = metadata
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
    else {
        return Err("invalid attachment");
    };
    let allowed = match attachment.kind {
        AttachmentKind::Image => ["image/jpeg", "image/png", "image/webp"].contains(&mime),
        AttachmentKind::Audio => [
            "audio/aac",
            "audio/flac",
            "audio/mp4",
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
            "audio/webm",
            "audio/x-m4a",
            "audio/x-wav",
        ]
        .contains(&mime),
    };
    if !allowed {
        return Err("invalid attachment");
    }
    let decoded = validate_base64(payload)?;
    if decoded > MAX_ATTACHMENT_BYTES {
        return Err("attachment is too large");
    }
    let header = decode_base64_prefix(payload, 12).ok_or("invalid attachment")?;
    if !matches_magic(mime, &header) {
        return Err("invalid attachment");
    }
    Ok(())
}

fn validate_base64(payload: &str) -> Result<usize, &'static str> {
    let bytes = payload.as_bytes();
    if bytes.is_empty() || !bytes.len().is_multiple_of(4) {
        return Err("invalid attachment");
    }
    let padding = if bytes.ends_with(b"==") {
        2
    } else if bytes.ends_with(b"=") {
        1
    } else {
        0
    };
    let content = bytes.len().saturating_sub(padding);
    if content == 0
        || bytes[..content]
            .iter()
            .any(|byte| base64_value(*byte).is_none())
        || bytes[content..].iter().any(|byte| *byte != b'=')
    {
        return Err("invalid attachment");
    }
    let Some(last) = base64_value(bytes[content - 1]) else {
        return Err("invalid attachment");
    };
    if (padding == 2 && last & 0x0f != 0) || (padding == 1 && last & 0x03 != 0) {
        return Err("invalid attachment");
    }
    Ok(bytes.len() / 4 * 3 - padding)
}

fn base64_value(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

fn decode_base64_prefix(payload: &str, maximum: usize) -> Option<Vec<u8>> {
    let mut output = Vec::with_capacity(maximum);
    let mut buffer = 0_u32;
    let mut bits = 0_u8;
    for byte in payload.bytes().take_while(|byte| *byte != b'=') {
        buffer = (buffer << 6) | u32::from(base64_value(byte)?);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            if output.len() == maximum {
                break;
            }
            buffer &= (1_u32 << bits).saturating_sub(1);
        }
    }
    Some(output)
}

fn matches_magic(mime: &str, header: &[u8]) -> bool {
    match mime {
        "image/jpeg" => header.starts_with(&[0xff, 0xd8, 0xff]),
        "image/png" => header.starts_with(b"\x89PNG\r\n\x1a\n"),
        "image/webp" => {
            header.starts_with(b"RIFF") && header.get(8..12) == Some(b"WEBP".as_slice())
        }
        "audio/mpeg" => {
            header.starts_with(b"ID3")
                || header
                    .get(..2)
                    .is_some_and(|value| value[0] == 0xff && value[1] & 0xe0 == 0xe0)
        }
        "audio/aac" => header
            .get(..2)
            .is_some_and(|value| value[0] == 0xff && value[1] & 0xf6 == 0xf0),
        "audio/flac" => header.starts_with(b"fLaC"),
        "audio/mp4" | "audio/x-m4a" => header.get(4..8) == Some(b"ftyp".as_slice()),
        "audio/ogg" => header.starts_with(b"OggS"),
        "audio/wav" | "audio/x-wav" => {
            header.starts_with(b"RIFF") && header.get(8..12) == Some(b"WAVE".as_slice())
        }
        "audio/webm" => header.starts_with(&[0x1a, 0x45, 0xdf, 0xa3]),
        _ => false,
    }
}
