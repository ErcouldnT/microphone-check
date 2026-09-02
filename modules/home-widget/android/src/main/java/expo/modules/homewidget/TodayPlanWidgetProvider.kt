package expo.modules.homewidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Home screen widget listing what is still planned for today.
 *
 * Rows are built with nested RemoteViews rather than a collection widget: the
 * list is capped at a handful of entries, so this stays much simpler than a
 * RemoteViewsService and updates in a single pass.
 */
class TodayPlanWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { widgetId ->
      appWidgetManager.updateAppWidget(widgetId, buildViews(context))
    }
  }

  companion object {
    /** Redraws every placed instance of the widget. */
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        ComponentName(context, TodayPlanWidgetProvider::class.java)
      )
      if (ids.isEmpty()) return
      ids.forEach { manager.updateAppWidget(it, buildViews(context)) }
    }

    private fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_today_plan)

      views.setTextViewText(R.id.widget_date, formattedToday())
      views.removeAllViews(R.id.widget_list)

      val plans = TodayPlanRepository.getRemainingPlansForToday(context)

      if (plans.isEmpty()) {
        views.setViewVisibility(R.id.widget_empty, android.view.View.VISIBLE)
        views.setViewVisibility(R.id.widget_list, android.view.View.GONE)
      } else {
        views.setViewVisibility(R.id.widget_empty, android.view.View.GONE)
        views.setViewVisibility(R.id.widget_list, android.view.View.VISIBLE)

        val myRole = TodayPlanRepository.getMyRole(context)
        val limit = TodayPlanRepository.maxEntries()
        plans.take(limit).forEach { plan ->
          views.addView(R.id.widget_list, buildRow(context, plan, myRole))
        }

        val overflow = plans.size - limit
        if (overflow > 0) {
          val more = RemoteViews(context.packageName, R.layout.widget_today_plan_more)
          more.setTextViewText(R.id.widget_more_text, "+$overflow")
          views.addView(R.id.widget_list, more)
        }
      }

      // Tapping anywhere opens the app.
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launchIntent != null) {
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pendingIntent = PendingIntent.getActivity(
          context,
          0,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
      }

      return views
    }

    private fun buildRow(context: Context, plan: TodayPlanEntry, myRole: String): RemoteViews {
      val row = RemoteViews(context.packageName, R.layout.widget_today_plan_row)

      row.setTextViewText(R.id.row_time, if (plan.isAllDay) "•" else (plan.startTime ?: "--:--"))
      row.setTextViewText(R.id.row_title, plan.title)
      row.setTextViewText(R.id.row_target, targetEmoji(plan.target, myRole))
      row.setInt(R.id.row_color, "setBackgroundColor", parseColor(plan.color))

      return row
    }

    /** 💖 marks the partner's plans, ✨ shared ones, 👤 the user's own. */
    private fun targetEmoji(target: String, myRole: String): String {
      val partnerRole = if (myRole == "male") "female" else "male"
      return when (target) {
        "both" -> "✨"
        "partner", partnerRole -> "💖"
        else -> "👤"
      }
    }

    private fun parseColor(value: String): Int = try {
      Color.parseColor(value)
    } catch (e: IllegalArgumentException) {
      Color.parseColor("#00FFFF")
    }

    private fun formattedToday(): String {
      val format = SimpleDateFormat("d MMMM", Locale.getDefault())
      return format.format(Calendar.getInstance().time)
    }
  }
}
