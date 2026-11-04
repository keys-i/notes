use futures_util::StreamExt;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;
use worker::{Env, Fetch, Headers, Method, Request, RequestInit, Response, Url};

const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;
const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1/";

#[derive(Clone, Debug)]
pub struct Client {
    base: Url,
    token: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Config,
    Request,
    Response,
}

impl Client {
    pub fn from_env(env: &Env) -> Result<Self, Error> {
        let token = env
            .secret("MODEL_API_KEY")
            .map_err(|_| Error::Config)?
            .to_string();
        Self::new(GROQ_BASE_URL, &token)
    }

    pub fn new(base: &str, token: &str) -> Result<Self, Error> {
        let mut base = Url::parse(base).map_err(|_| Error::Config)?;
        if base.scheme() != "https"
            || base.host_str().is_none()
            || !base.username().is_empty()
            || base.password().is_some()
            || base.query().is_some()
            || base.fragment().is_some()
            || token.is_empty()
            || token.len() > 4096
            || token.chars().any(char::is_control)
        {
            return Err(Error::Config);
        }
        let path = format!("{}/", base.path().trim_end_matches('/'));
        base.set_path(&path);
        Ok(Self {
            base,
            token: token.into(),
        })
    }

    pub async fn chat<T, R>(&self, model: &str, input: &T) -> Result<R, Error>
    where
        T: Serialize,
        R: DeserializeOwned,
    {
        self.post("chat/completions", request_body(model, input)?)
            .await
    }

    pub async fn transcribe(
        &self,
        model: &str,
        audio: &[u8],
        extension: &str,
    ) -> Result<String, Error> {
        let (body, content_type) = audio_multipart(model, audio, extension)?;
        let body = worker::js_sys::Uint8Array::from(body.as_slice());
        let reply: TranscriptionReply = self
            .send("audio/transcriptions", body.into(), &content_type)
            .await?;
        if reply.text.trim().is_empty() {
            return Err(Error::Response);
        }
        Ok(reply.text)
    }

    async fn post<T, R>(&self, path: &str, body: T) -> Result<R, Error>
    where
        T: Serialize,
        R: DeserializeOwned,
    {
        let body = serde_json::to_string(&body).map_err(|_| Error::Request)?;
        self.send(
            path,
            worker::wasm_bindgen::JsValue::from_str(&body),
            "application/json",
        )
        .await
    }

    async fn send<R>(
        &self,
        path: &str,
        body: worker::wasm_bindgen::JsValue,
        content_type: &str,
    ) -> Result<R, Error>
    where
        R: DeserializeOwned,
    {
        let url = self.base.join(path).map_err(|_| Error::Config)?;
        let headers = Headers::new();
        headers
            .set("Authorization", &format!("Bearer {}", self.token))
            .map_err(|_| Error::Request)?;
        headers
            .set("Content-Type", content_type)
            .map_err(|_| Error::Request)?;
        headers
            .set("Accept", "application/json")
            .map_err(|_| Error::Request)?;
        let mut init = RequestInit::new();
        init.with_method(Method::Post)
            .with_headers(headers)
            .with_body(Some(body));
        let request = Request::new_with_init(url.as_str(), &init).map_err(|_| Error::Request)?;
        let mut response = Fetch::Request(request)
            .send()
            .await
            .map_err(|_| Error::Request)?;
        if !(200..300).contains(&response.status_code()) {
            return Err(Error::Response);
        }
        let body = bounded_body(&mut response).await?;
        serde_json::from_slice(&body).map_err(|_| Error::Response)
    }
}

fn request_body<T: Serialize>(model: &str, input: &T) -> Result<Value, Error> {
    validate_model(model)?;
    let mut body = serde_json::to_value(input).map_err(|_| Error::Request)?;
    let Value::Object(fields) = &mut body else {
        return Err(Error::Request);
    };
    fields.insert("model".into(), Value::String(model.into()));
    Ok(body)
}

fn validate_model(model: &str) -> Result<(), Error> {
    if model.is_empty() || model.len() > 128 || model.chars().any(char::is_control) {
        return Err(Error::Config);
    }
    Ok(())
}

fn audio_multipart(model: &str, audio: &[u8], extension: &str) -> Result<(Vec<u8>, String), Error> {
    const BOUNDARY: &str = "notes-pet-audio-boundary";
    validate_model(model)?;
    if audio.is_empty()
        || extension.is_empty()
        || extension.len() > 8
        || !extension
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    {
        return Err(Error::Request);
    }
    let mut body = Vec::with_capacity(audio.len() + 512);
    body.extend_from_slice(
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{model}\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"question.{extension}\"\r\nContent-Type: application/octet-stream\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(audio);
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    Ok((body, format!("multipart/form-data; boundary={BOUNDARY}")))
}

async fn bounded_body(response: &mut Response) -> Result<Vec<u8>, Error> {
    let mut body = Vec::new();
    let mut stream = response.stream().map_err(|_| Error::Response)?;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| Error::Response)?;
        if body.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err(Error::Response);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

#[derive(Debug, serde::Deserialize)]
struct TranscriptionReply {
    text: String,
}

#[cfg(test)]
mod tests {
    use super::{Client, Error, GROQ_BASE_URL, audio_multipart, request_body};
    use serde::Serialize;

    #[derive(Serialize)]
    struct Payload {
        prompt: &'static str,
    }

    #[derive(Serialize)]
    struct UntrustedModel {
        model: &'static str,
        prompt: &'static str,
    }

    #[test]
    fn backend_requires_a_credentialed_https_origin() {
        assert_eq!(GROQ_BASE_URL, "https://api.groq.com/openai/v1/");
        assert!(Client::new("https://models.example/v1", "secret").is_ok());
        assert_eq!(
            Client::new("http://models.example/v1", "secret").unwrap_err(),
            Error::Config
        );
        assert_eq!(
            Client::new("https://localhost/v1", "").unwrap_err(),
            Error::Config
        );
        assert_eq!(
            Client::new("https://name:pass@models.example/v1", "secret").unwrap_err(),
            Error::Config
        );
        assert_eq!(
            Client::new("https://models.example/v1?debug=1", "secret").unwrap_err(),
            Error::Config
        );
    }

    #[test]
    fn compatible_requests_add_only_the_server_owned_model_alias() {
        let body = request_body("fast", &Payload { prompt: "hello" }).unwrap();
        assert_eq!(body["model"], "fast");
        assert_eq!(body["prompt"], "hello");
        let overridden = request_body(
            "fast",
            &UntrustedModel {
                model: "attacker-choice",
                prompt: "hello",
            },
        )
        .unwrap();
        assert_eq!(overridden["model"], "fast");
        assert_eq!(
            request_body("", &Payload { prompt: "hello" }),
            Err(Error::Config)
        );
    }

    #[test]
    fn transcription_body_is_bounded_to_owned_fields_and_audio() {
        let (body, content_type) =
            audio_multipart("openai/whisper-large-v3-turbo", b"RIFFaudio", "wav").unwrap();
        assert_eq!(
            content_type,
            "multipart/form-data; boundary=notes-pet-audio-boundary"
        );
        assert!(body.windows(9).any(|part| part == b"RIFFaudio"));
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("openai/whisper-large-v3-turbo"));
        assert!(text.contains("filename=\"question.wav\""));
        assert_eq!(
            audio_multipart("audio", b"RIFF", "wav\r\nunsafe"),
            Err(Error::Request)
        );
    }
}
