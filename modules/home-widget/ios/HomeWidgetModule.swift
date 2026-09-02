import ExpoModulesCore
import WidgetKit

/**
 * Bridges today's plan to the WidgetKit extension.
 *
 * A widget extension runs in its own process and cannot reach the app's
 * sandboxed SQLite file, so the app writes a small JSON snapshot into the
 * shared App Group container and asks WidgetKit to redraw.
 */
public class HomeWidgetModule: Module {
  /// Must match the App Group configured on both the app and the extension.
  static let appGroupIdentifier = "group.com.ercode.microphonecheck"
  static let todayPlanKey = "today_plan_snapshot"

  public func definition() -> ModuleDefinition {
    Name("HomeWidget")

    Function("setTodayPlan") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: HomeWidgetModule.appGroupIdentifier) else {
        return false
      }
      defaults.set(json, forKey: HomeWidgetModule.todayPlanKey)
      HomeWidgetModule.reloadWidgets()
      return true
    }

    Function("refresh") { () -> Bool in
      HomeWidgetModule.reloadWidgets()
      return true
    }

    Function("isSupported") { () -> Bool in
      if #available(iOS 14.0, *) { return true }
      return false
    }
  }

  private static func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
