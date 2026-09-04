import SwiftUI
import WidgetKit

/**
 * Hosts everything this extension provides: the home screen widget and, on
 * versions that support it, the running-plan Live Activity.
 */
@main
struct TodayPlanWidgetBundle: WidgetBundle {
  var body: some Widget {
    TodayPlanWidget()

    if #available(iOS 16.2, *) {
      PlanLiveActivity()
    }
  }
}
