package expo.modules.homewidget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Android's stand-in for the iOS Live Activity.
 *
 * Android has no ActivityKit. The closest equivalent that works everywhere is
 * an ongoing notification carrying a countdown chronometer and a progress bar:
 * it sits at the top of the shade, cannot be swiped away while the plan runs,
 * and shows the same information the Lock Screen activity does on iOS.
 */
object RunningPlanNotification {

  private const val CHANNEL_ID = "running_plan"
  private const val NOTIFICATION_ID = 4711

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Şu an süren plan",
      // Low: it should sit there quietly, not buzz. The plan's own reminder
      // already announced the start.
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Devam eden planı gösterir"
      setShowBadge(false)
      enableVibration(false)
    }
    manager.createNotificationChannel(channel)
  }

  /**
   * Shows or refreshes the ongoing notification for the plan that is running.
   *
   * @param startedAt epoch millis the plan began
   * @param endsAt epoch millis it ends
   */
  fun show(
    context: Context,
    title: String,
    who: String,
    startedAt: Long,
    endsAt: Long,
    colorHex: String
  ) {
    ensureChannel(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP) }

    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val total = (endsAt - startedAt).coerceAtLeast(1L)
    val elapsed = (System.currentTimeMillis() - startedAt).coerceIn(0L, total)
    val progress = ((elapsed * 100) / total).toInt()

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(title)
      .setContentText(who)
      // A collapsed notification with a progress bar hides its content text,
      // and whose plan it is is the whole point here, so it also goes in the
      // header line where it always shows.
      .setSubText(who)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(endsAt)
      // Counts down to the end of the plan, the same countdown the Dynamic
      // Island shows on iOS.
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setProgress(100, progress, false)
      .setCategory(NotificationCompat.CATEGORY_EVENT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setColorized(true)
      .setColor(parseColor(colorHex))
      .setContentIntent(contentIntent)

    // Android 14+ keeps promoted ongoing notifications pinned in the status bar.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      builder.foregroundServiceBehavior = Notification.FOREGROUND_SERVICE_IMMEDIATE
    }

    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
    } catch (e: SecurityException) {
      // Notification permission not granted; nothing to show.
    }
  }

  /** Clears it when the plan ends or is ticked off. */
  fun clear(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  /**
   * The app's own notification icon.
   *
   * This module is a separate Gradle library, so the app's drawable cannot be
   * referenced through R; it is resolved by name at runtime instead.
   */
  private fun smallIcon(context: Context): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else android.R.drawable.ic_menu_my_calendar
  }

  private fun parseColor(value: String): Int = try {
    Color.parseColor(value)
  } catch (e: IllegalArgumentException) {
    Color.parseColor("#00FFFF")
  }
}
