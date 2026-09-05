package expo.modules.homewidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

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

    // Android has no ActivityKit; the running plan is surfaced as an ongoing
    // notification instead, which is the closest equivalent available.
    Function("areLiveActivitiesEnabled") { true }

    Function("startPlanActivity") { json: String ->
      val context = appContext.reactContext ?: return@Function false
      try {
        val payload = JSONObject(json)
        RunningPlanNotification.show(
          context = context,
          title = payload.optString("title"),
          who = payload.optString("who"),
          startedAt = payload.optDouble("startedAt").toLong(),
          endsAt = payload.optDouble("endsAt").toLong(),
          colorHex = payload.optString("colorHex", "#00FFFF")
        )
        true
      } catch (e: Exception) {
        android.util.Log.w("HomeWidget", "Could not show running plan: ${e.message}")
        false
      }
    }

    Function("endPlanActivity") {
      val context = appContext.reactContext ?: return@Function false
      RunningPlanNotification.clear(context)
      true
    }
  }
}
