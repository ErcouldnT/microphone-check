import ActivityKit
import Foundation

/**
 * Shape of the Live Activity showing the plan that is running right now.
 *
 * Declared identically in the app's HomeWidget module so both sides encode the
 * same thing; ActivityKit matches activities by this type, and the extension
 * and the app are separate binaries that cannot share one file here.
 */
struct PlanActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Plan title, e.g. "Spor salonu".
    var title: String
    /// Who it belongs to, already resolved to a display name.
    var who: String
    /// When it ends, used for the countdown and the progress bar.
    var endsAt: Date
    /// When it started, so the bar can show elapsed proportion.
    var startedAt: Date
    /// Hex accent, matching the plan's colour in the app.
    var colorHex: String
    /// True when this is the *other* person's plan.
    var isPartner: Bool
  }

  /// Identifies which plan this activity belongs to.
  var planId: String
}
