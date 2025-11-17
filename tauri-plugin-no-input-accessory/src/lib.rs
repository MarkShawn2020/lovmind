use tauri::{
  plugin::{Builder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "ios")]
mod mobile;
mod error;

pub use error::{Error, Result};

/// Initializes the plugin.
/// This plugin automatically removes the iOS keyboard input accessory view
/// when the WebView loads. No frontend interaction required.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("no-input-accessory")
    .setup(|app, api| {
      #[cfg(target_os = "ios")]
      {
        let _no_input_accessory = mobile::init(app, api)?;
        // Plugin is registered and will automatically call load(webview:) on WebView creation
      }
      Ok(())
    })
    .build()
}
