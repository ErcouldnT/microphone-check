package expo.modules.homewidget

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** One plan row as the widget needs it. */
data class TodayPlanEntry(
  val title: String,
  val startTime: String?,
  val endTime: String?,
  val isAllDay: Boolean,
  val color: String,
  val target: String
)

/**
 * Reads today's plans straight out of the app's SQLite database.
 *
 * The widget runs in the app's own process, so it can open the same file
 * expo-sqlite uses. Reading directly avoids having to mirror the data into
 * SharedPreferences and keeps the widget correct even if the app has not run
 * since the last edit.
 */
object TodayPlanRepository {

  private const val DATABASE_RELATIVE_PATH = "SQLite/microphone_check.db"
  private const val MAX_ENTRIES = 5

  fun todayDateString(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)

  /**
   * Plans still ahead today, in display order.
   *
   * Mirrors `utils/todayPlan.ts` on the JS side: completed plans and timed
   * plans whose end time has passed are left out, all-day plans stay all day.
   */
  fun getRemainingPlansForToday(context: Context): List<TodayPlanEntry> {
    val dbFile = File(context.filesDir, DATABASE_RELATIVE_PATH)
    if (!dbFile.exists()) return emptyList()

    val today = todayDateString()
    val nowMinutes = currentMinutesOfDay()
    val entries = mutableListOf<TodayPlanEntry>()

    var db: SQLiteDatabase? = null
    try {
      // Opened read/write because expo-sqlite runs in WAL mode, which needs to
      // touch the -shm/-wal sidecar files even for reads.
      db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)

      val cursor = db.rawQuery(
        """
        SELECT title, start_time, end_time, is_all_day, color, target, completed, end_date
        FROM events
        WHERE start_date <= ? AND end_date >= ?
        """.trimIndent(),
        arrayOf(today, today)
      )

      cursor.use { c ->
        while (c.moveToNext()) {
          val completed = c.getInt(6) == 1
          if (completed) continue

          val isAllDay = c.getInt(3) == 1
          val startTime = c.getString(1)
          val endTime = c.getString(2)
          val endDate = c.getString(7) ?: today

          if (!isAllDay && endDate == today) {
            val reference = endTime ?: startTime
            val minutes = parseMinutes(reference)
            if (minutes != null && nowMinutes > minutes) continue
          }

          entries.add(
            TodayPlanEntry(
              title = c.getString(0) ?: "",
              startTime = startTime,
              endTime = endTime,
              isAllDay = isAllDay,
              color = c.getString(4) ?: "#00FFFF",
              target = c.getString(5) ?: "both"
            )
          )
        }
      }
    } catch (e: Exception) {
      android.util.Log.w("TodayPlanWidget", "Could not read plans: ${e.message}")
      return emptyList()
    } finally {
      try {
        db?.close()
      } catch (_: Exception) {
      }
    }

    // All-day plans first, then chronological.
    return entries.sortedWith(
      compareByDescending<TodayPlanEntry> { it.isAllDay }
        .thenBy { it.startTime ?: "" }
    )
  }

  fun maxEntries(): Int = MAX_ENTRIES

  /** The role this device belongs to ("male" / "female"), defaulting to male. */
  fun getMyRole(context: Context): String {
    val dbFile = File(context.filesDir, DATABASE_RELATIVE_PATH)
    if (!dbFile.exists()) return "male"

    var db: SQLiteDatabase? = null
    return try {
      db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
      db.rawQuery("SELECT value FROM settings WHERE key = 'my_role' LIMIT 1", null).use { c ->
        if (c.moveToFirst()) c.getString(0) ?: "male" else "male"
      }
    } catch (e: Exception) {
      "male"
    } finally {
      try {
        db?.close()
      } catch (_: Exception) {
      }
    }
  }

  private fun currentMinutesOfDay(): Int {
    val now = Calendar.getInstance()
    return now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
  }

  /** "HH:mm" -> minutes since midnight, or null when unparseable. */
  private fun parseMinutes(value: String?): Int? {
    if (value.isNullOrBlank()) return null
    val parts = value.split(":")
    if (parts.size < 2) return null
    val hours = parts[0].toIntOrNull() ?: return null
    val minutes = parts[1].toIntOrNull() ?: return null
    return hours * 60 + minutes
  }
}
