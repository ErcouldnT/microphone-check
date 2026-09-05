package expo.modules.homewidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Home screen widget listing today's plans.
 *
 * The rows come from a RemoteViewsService-backed collection rather than being
 * stacked in directly: a collection scrolls and has no practical row limit, so
 * a busy day is fully reachable instead of stopping after a handful.
 */
class TodayPlanWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { widgetId ->
      appWidgetManager.updateAppWidget(widgetId, buildViews(context, widgetId))
    }
    appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_list)
  }

  companion object {
    /** Redraws every placed instance and reloads their lists. */
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        ComponentName(context, TodayPlanWidgetProvider::class.java)
      )
      if (ids.isEmpty()) return

      ids.forEach { manager.updateAppWidget(it, buildViews(context, it)) }
      manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list)
    }

    private fun buildViews(context: Context, widgetId: Int): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_today_plan)
      views.setTextViewText(R.id.widget_date, formattedToday())

      // Each widget instance needs a distinct intent, or the system reuses one
      // factory for all of them.
      val adapterIntent = Intent(context, TodayPlanRemoteViewsService::class.java).apply {
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
      }
      views.setRemoteAdapter(R.id.widget_list, adapterIntent)
      views.setEmptyView(R.id.widget_list, R.id.widget_empty)

      // Tapping the widget — chrome or any row — opens the app.
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launchIntent != null) {
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pendingIntent = PendingIntent.getActivity(
          context,
          0,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_header, pendingIntent)

        // Rows in a collection fill in this template instead of owning intents.
        val templateIntent = PendingIntent.getActivity(
          context,
          1,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.widget_list, templateIntent)
      }

      return views
    }

    private fun formattedToday(): String {
      val format = SimpleDateFormat("d MMMM", Locale.getDefault())
      return format.format(Calendar.getInstance().time)
    }
  }
}
