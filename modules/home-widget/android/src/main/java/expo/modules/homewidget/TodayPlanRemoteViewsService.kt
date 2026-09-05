package expo.modules.homewidget

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.text.SpannableString
import android.text.style.StrikethroughSpan
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Feeds the widget's list.
 *
 * The rows used to be built with nested RemoteViews and capped at a handful,
 * which meant a busy day was silently truncated. A collection view has no such
 * limit and scrolls, so the whole day is reachable from the home screen.
 */
class TodayPlanRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
    TodayPlanRemoteViewsFactory(applicationContext)
}

private class TodayPlanRemoteViewsFactory(
  private val context: Context
) : RemoteViewsService.RemoteViewsFactory {

  private var plans: List<TodayPlanEntry> = emptyList()
  private var myRole: String = "male"

  override fun onCreate() = Unit

  /** Called on every notifyAppWidgetViewDataChanged, and once up front. */
  override fun onDataSetChanged() {
    plans = TodayPlanRepository.getPlansForToday(context)
    myRole = TodayPlanRepository.getMyRole(context)
  }

  override fun onDestroy() {
    plans = emptyList()
  }

  override fun getCount(): Int = plans.size

  override fun getViewAt(position: Int): RemoteViews {
    val row = RemoteViews(context.packageName, R.layout.widget_today_plan_row)
    val plan = plans.getOrNull(position) ?: return row

    row.setTextViewText(R.id.row_time, if (plan.isAllDay) "•" else (plan.startTime ?: "--:--"))
    row.setTextViewText(R.id.row_target, targetEmoji(plan.target, myRole))
    row.setInt(R.id.row_color, "setBackgroundColor", parseColor(plan.color))

    if (plan.isDone) {
      // Struck through and dimmed, so the day reads as a whole while what is
      // still ahead stays obvious at the top.
      val struck = SpannableString(plan.title)
      struck.setSpan(StrikethroughSpan(), 0, struck.length, 0)
      row.setTextViewText(R.id.row_title, struck)
      row.setTextColor(R.id.row_title, Color.parseColor("#6B6B76"))
      row.setTextColor(R.id.row_time, Color.parseColor("#4B4B55"))
      row.setInt(R.id.row_color, "setAlpha", 90)
    } else {
      row.setTextViewText(R.id.row_title, plan.title)
      row.setTextColor(R.id.row_title, Color.WHITE)
      row.setTextColor(R.id.row_time, Color.parseColor("#8A8A94"))
      row.setInt(R.id.row_color, "setAlpha", 255)
    }

    // Collection children cannot own a PendingIntent; they fill in the
    // template the provider set on the list.
    row.setOnClickFillInIntent(R.id.row_root, Intent())
    return row
  }

  override fun getLoadingView(): RemoteViews? = null

  override fun getViewTypeCount(): Int = 1

  override fun getItemId(position: Int): Long = position.toLong()

  override fun hasStableIds(): Boolean = false

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
}
