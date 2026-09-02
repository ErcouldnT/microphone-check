package expo.modules.homewidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Lets the JS side redraw the home screen widget as soon as plans change,
 * instead of waiting for the system's half-hourly update tick.
 */
class HomeWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HomeWidget")

    Function("refresh") {
      val context = appContext.reactContext ?: return@Function false
      TodayPlanWidgetProvider.refreshAll(context)
      true
    }

    // The Android widget reads the app database itself, so the snapshot the JS
    // side passes is only needed on iOS. Accepting it here keeps one call site.
    Function("setTodayPlan") { _: String ->
      val context = appContext.reactContext ?: return@Function false
      TodayPlanWidgetProvider.refreshAll(context)
      true
    }

    Function("isSupported") { true }
  }
}
