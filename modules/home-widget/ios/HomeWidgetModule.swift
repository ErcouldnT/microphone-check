import ActivityKit
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

    // MARK: Live Activity

    Function("areLiveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// Starts or updates the activity for the plan that is running now.
    Function("startPlanActivity") { (json: String) -> Bool in
      guard #available(iOS 16.2, *),
            let data = json.data(using: .utf8),
            let payload = try? JSONDecoder().decode(PlanActivityPayload.self, from: data)
      else { return false }

      do {
        try PlanActivityController.start(payload)
        return true
      } catch {
        return false
      }
    }

    Function("endPlanActivity") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      Task { await PlanActivityController.endAll() }
      return true
    }
  }

  private static func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

// MARK: - Live Activity

/// JSON the JS side sends to describe the plan that is running.
struct PlanActivityPayload: Decodable {
  let planId: String
  let title: String
  let who: String
  /// Epoch milliseconds.
  let startedAt: Double
  let endsAt: Double
  let colorHex: String
  let isPartner: Bool
}

@available(iOS 16.2, *)
enum PlanActivityController {
  /// Only one plan runs at a time, so a single activity is reused.
  static func start(_ payload: PlanActivityPayload) throws {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

    // Replace any activity for a different plan.
    if let existing = Activity<PlanActivityAttributes>.activities.first {
      if existing.attributes.planId == payload.planId {
        Task { await update(payload) }
        return
      }
      Task { await existing.end(nil, dismissalPolicy: .immediate) }
    }

    _ = try Activity.request(
      attributes: PlanActivityAttributes(planId: payload.planId),
      contentState: payload.contentState,
      pushType: nil
    )
  }

  static func update(_ payload: PlanActivityPayload) async {
    for activity in Activity<PlanActivityAttributes>.activities
    where activity.attributes.planId == payload.planId {
      await activity.update(using: payload.contentState)
    }
  }

  static func endAll() async {
    for activity in Activity<PlanActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}

@available(iOS 16.2, *)
extension PlanActivityPayload {
  var contentState: PlanActivityAttributes.ContentState {
    PlanActivityAttributes.ContentState(
      title: title,
      who: who,
      endsAt: Date(timeIntervalSince1970: endsAt / 1000),
      startedAt: Date(timeIntervalSince1970: startedAt / 1000),
      colorHex: colorHex,
      isPartner: isPartner
    )
  }
}
