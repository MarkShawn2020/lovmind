# tauri-plugin-no-input-accessory

A Tauri plugin that removes the iOS keyboard input accessory view (the toolbar with "Done", "Previous", "Next" buttons above the keyboard).

## Why This Plugin Exists

iOS's WKWebView automatically shows an Input Accessory View above the keyboard when users tap into text inputs. For a native-like note-taking app experience, this toolbar is often undesirable.

## Technical Approach

Since Tauri v2 doesn't expose hooks to customize WKWebView creation, this plugin uses **Objective-C runtime method swizzling** to override `inputAccessoryView` at runtime:

1. **WKWebView Swizzling**: Exchanges the `inputAccessoryView` property getter with a custom implementation that returns `nil`
2. **WKContentView Patching**: Directly patches the internal `WKContentView` class (which handles actual input) using `imp_implementationWithBlock`
3. **Early Initialization**: Swizzling happens in plugin `init()` before WebView creates keyboard accessory

## Usage

This plugin is iOS-only and requires no frontend interaction.

### Installation

Add to `src-tauri/Cargo.toml`:

```toml
[target.'cfg(target_os = "ios")'.dependencies]
tauri-plugin-no-input-accessory = { path = "../tauri-plugin-no-input-accessory" }
```

### Registration

Add to Tauri's builder in `src-tauri/src/lib.rs`:

```rust
#[cfg(target_os = "ios")]
let builder = builder.plugin(tauri_plugin_no_input_accessory::init());
```

### Verification

Build the iOS app and check Xcode console for:
```
[NoInputAccessory] Removing input accessory view from WKWebView
[NoInputAccessory] Swizzled WKWebView.inputAccessoryView
[NoInputAccessory] Patched WKContentView.inputAccessoryView
[NoInputAccessory] SUCCESS: Input accessory view removal completed
```

## Limitations

- **Method swizzling risk**: Modifies system class behavior at runtime
- **iOS version compatibility**: May break if Apple changes WKWebView internals
- **App Store**: Generally acceptable for benign customizations, but test thoroughly
- **Global effect**: Affects all WKWebView instances in the app (usually desired)

## Alternative Approaches Considered

1. **WKWebView subclassing** (reference solution): Requires modifying Tauri's WebView creation, not feasible with current plugin API
2. **Runtime view hierarchy manipulation**: Too fragile, timing-dependent
3. **CSS/JavaScript hacks**: Cannot affect native UIKit components

## Why Not Use the Reference Solution?

The typical iOS solution involves creating a custom `WKWebView` subclass:

```swift
class WebViewWithoutAccessory: WKWebView {
    override var inputAccessoryView: UIView? { return nil }
}
```

However, Tauri creates WKWebView instances internally in Rust code (`tauri-runtime-wry` → `wry` crate). The plugin API's `Plugin::load(webview:)` method receives an already-instantiated WKWebView, making subclassing impossible without modifying Tauri's source.

## Future Improvements

If Tauri adds WebView customization hooks, this plugin should migrate to a cleaner subclassing approach.
