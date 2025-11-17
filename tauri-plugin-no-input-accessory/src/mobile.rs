use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_no_input_accessory);

// Initializes the iOS plugin
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<NoInputAccessory<R>> {
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_no_input_accessory)?;
  Ok(NoInputAccessory(handle))
}

/// Access to the no-input-accessory plugin.
/// This plugin has no runtime methods - it automatically removes
/// the keyboard input accessory view when the WebView loads.
pub struct NoInputAccessory<R: Runtime>(PluginHandle<R>);
