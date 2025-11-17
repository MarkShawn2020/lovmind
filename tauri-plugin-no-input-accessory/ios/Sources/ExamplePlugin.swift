import SwiftRs
import Tauri
import UIKit
import WebKit

@objc(NoInputAccessoryPlugin)
public class NoInputAccessoryPlugin: Plugin {
    @objc public override func load(webview: WKWebView) {
        print("[NoInputAccessory] Plugin loading - removing keyboard input accessory view")

        // Delay execution slightly to ensure WebView is fully initialized
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak webview] in
            guard let webview = webview else {
                print("[NoInputAccessory] ERROR: WebView is nil")
                return
            }

            self.removeInputAccessoryView(from: webview)
        }
    }

    private func removeInputAccessoryView(from webview: WKWebView) {
        // Create an empty view to replace the default input accessory view
        let emptyView = UIView(frame: .zero)
        emptyView.backgroundColor = .clear

        // Find WKContentView within the WKWebView's scroll view
        guard let wkContentView = webview.scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else {
            print("[NoInputAccessory] WARNING: Could not find WKContentView")
            return
        }

        print("[NoInputAccessory] Found WKContentView: \(type(of: wkContentView))")

        // Iterate through all subviews of WKContentView
        var replacedCount = 0
        for subview in wkContentView.subviews {
            // Only process views that can become first responder (input views)
            guard subview.canBecomeFirstResponder else {
                continue
            }

            // Use Objective-C runtime to set inputAccessoryView
            let selector = Selector(("setInputAccessoryView:"))
            if subview.responds(to: selector) {
                subview.perform(selector, with: emptyView)
                replacedCount += 1
                print("[NoInputAccessory] Replaced input accessory view for subview: \(type(of: subview))")
            }
        }

        if replacedCount > 0 {
            print("[NoInputAccessory] SUCCESS: Replaced \(replacedCount) input accessory view(s)")
        } else {
            print("[NoInputAccessory] INFO: No input accessory views found to replace")
        }
    }
}

@_cdecl("init_plugin_no_input_accessory")
func initPlugin() -> Plugin {
    return NoInputAccessoryPlugin()
}
