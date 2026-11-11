//! Cloudflare Cache access with one background-write lifecycle

use serde::de::DeserializeOwned;
use worker::{Cache, Context, Response, Result};

pub(crate) async fn response(key: &str) -> Result<Option<Response>> {
    Cache::default().get(key, false).await
}

pub(crate) async fn json<T: DeserializeOwned>(key: &str) -> Result<Option<T>> {
    let Some(mut response) = response(key).await? else {
        return Ok(None);
    };
    Ok(response.json::<T>().await.ok())
}

pub(crate) fn put(context: &Context, key: String, response: Response) {
    context.wait_until(async move {
        if let Err(error) = Cache::default().put(key, response).await {
            worker::console_error!("Edge cache write failed: {error}");
        }
    });
}
