import SwiftRs
import Tauri
import UIKit
import WebKit
import ObjectiveC

@objc(NoInputAccessoryPlugin)
public class NoInputAccessoryPlugin: Plugin {
    private static var hasSwizzled = false
    private static let swizzleLock = NSLock()

    @objc public override init() {
        super.init()
        Self.removeInputAccessoryView()
    }

    private static func removeInputAccessoryView() {
        swizzleLock.lock()
        defer { swizzleLock.unlock() }

        guard !hasSwizzled else {
            print("[NoInputAccessory] Already patched, skipping")
            return
        }

        print("[NoInputAccessory] Removing input accessory view from WKWebView")

        // Method 1: Direct extension override (works in some iOS versions)
        // This is already defined below in the extension

        // Method 2: Swizzle to ensure it works across all WKWebView instances
        swizzleWKWebView()

        // Method 3: Also handle WKContentView (the actual input container)
        swizzleWKContentView()

        hasSwizzled = true
        print("[NoInputAccessory] SUCCESS: Input accessory view removal completed")
    }

    private static func swizzleWKWebView() {
        guard let wkClass = NSClassFromString("WKWebView") else { return }

        let originalSelector = NSSelectorFromString("inputAccessoryView")
        let swizzledSelector = #selector(WKWebView.noAccessory_inputAccessoryView)

        if let originalMethod = class_getInstanceMethod(wkClass, originalSelector),
           let swizzledMethod = class_getInstanceMethod(WKWebView.self, swizzledSelector) {
            method_exchangeImplementations(originalMethod, swizzledMethod)
            print("[NoInputAccessory] Swizzled WKWebView.inputAccessoryView")
        }
    }

    private static func swizzleWKContentView() {
        // WKContentView is the internal view that actually handles input
        guard let contentViewClass = NSClassFromString("WKContentView") else {
            print("[NoInputAccessory] WKContentView class not found (might be normal)")
            return
        }

        let originalSelector = NSSelectorFromString("inputAccessoryView")

        // Create a method that returns nil
        let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        let implementation = imp_implementationWithBlock(block as Any)

        // Replace the method implementation
        if let originalMethod = class_getInstanceMethod(contentViewClass, originalSelector) {
            method_setImplementation(originalMethod, implementation)
            print("[NoInputAccessory] Patched WKContentView.inputAccessoryView")
        }
    }
}

// Extension to provide swizzled implementation
extension WKWebView {
    @objc dynamic func noAccessory_inputAccessoryView() -> UIView? {
        // This swizzled method returns nil instead of the original inputAccessoryView
        // After swizzling, calling inputAccessoryView will execute this method
        return nil
    }
}

@_cdecl("init_plugin_no_input_accessory")
func initPlugin() -> Plugin {
    return NoInputAccessoryPlugin()
}
