import SwiftUI
import WidgetKit

// MARK: - Shared snapshot

/// Mirrors `TodayPlanSnapshot` written by the app through HomeWidgetModule.
struct TodayPlanSnapshot: Codable {
  let date: String
  let dateLabel: String
  let title: String
  let emptyLabel: String
  let items: [TodayPlanItem]

  static let empty = TodayPlanSnapshot(
    date: "",
    dateLabel: "",
    title: "TODAY'S PLAN",
    emptyLabel: "Nothing planned for today.",
    items: []
  )
}

struct TodayPlanItem: Codable, Identifiable {
  let title: String
  let time: String?
  let color: String
  let target: String

  var id: String { "\(title)-\(time ?? "allday")" }

  /// 💖 the partner's plan, ✨ shared, 👤 the user's own.
  var targetEmoji: String {
    switch target {
    case "both": return "✨"
    case "partner": return "💖"
    default: return "👤"
    }
  }
}

private let appGroupIdentifier = "group.com.ercode.microphonecheck"
private let todayPlanKey = "today_plan_snapshot"

private func loadSnapshot() -> TodayPlanSnapshot {
  guard
    let defaults = UserDefaults(suiteName: appGroupIdentifier),
    let json = defaults.string(forKey: todayPlanKey),
    let data = json.data(using: .utf8),
    let decoded = try? JSONDecoder().decode(TodayPlanSnapshot.self, from: data)
  else {
    return .empty
  }
  return decoded
}

// MARK: - Timeline

struct TodayPlanEntry: TimelineEntry {
  let date: Date
  let snapshot: TodayPlanSnapshot
}

struct TodayPlanProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayPlanEntry {
    TodayPlanEntry(date: Date(), snapshot: .empty)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayPlanEntry) -> Void) {
    completion(TodayPlanEntry(date: Date(), snapshot: loadSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayPlanEntry>) -> Void) {
    let entry = TodayPlanEntry(date: Date(), snapshot: loadSnapshot())
    // Refresh on the hour so plans drop off as their end time passes; the app
    // also reloads timelines directly whenever the calendar changes.
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

// MARK: - View

struct TodayPlanWidgetView: View {
  var entry: TodayPlanEntry

  private var visibleItems: [TodayPlanItem] {
    Array(entry.snapshot.items.prefix(4))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(entry.snapshot.title)
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(Color(hex: "#00FFFF"))
          .lineLimit(1)
        Spacer()
        Text(entry.snapshot.dateLabel)
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(.secondary)
      }

      if visibleItems.isEmpty {
        Spacer()
        Text(entry.snapshot.emptyLabel)
          .font(.system(size: 12))
          .foregroundColor(.secondary)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer()
      } else {
        ForEach(visibleItems) { item in
          HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2)
              .fill(Color(hex: item.color))
              .frame(width: 3, height: 18)

            Text(item.time ?? "•")
              .font(.system(size: 11, design: .monospaced))
              .foregroundColor(.secondary)
              .frame(width: 40, alignment: .leading)

            Text(item.title)
              .font(.system(size: 12, weight: .bold))
              .foregroundColor(.primary)
              .lineLimit(1)

            Spacer(minLength: 4)

            Text(item.targetEmoji)
              .font(.system(size: 11))
          }
        }

        if entry.snapshot.items.count > visibleItems.count {
          Text("+\(entry.snapshot.items.count - visibleItems.count)")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(.secondary)
            .padding(.leading, 51)
        }

        Spacer(minLength: 0)
      }
    }
    .padding(14)
  }
}

// MARK: - Widget

@main
struct TodayPlanWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TodayPlanWidget", provider: TodayPlanProvider()) { entry in
      if #available(iOS 17.0, *) {
        TodayPlanWidgetView(entry: entry)
          .containerBackground(Color(hex: "#0B0B10"), for: .widget)
      } else {
        TodayPlanWidgetView(entry: entry)
          .background(Color(hex: "#0B0B10"))
      }
    }
    .configurationDisplayName("Microphone Check")
    .description("What is still planned for today.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

// MARK: - Helpers

extension Color {
  /// Builds a colour from a "#RRGGBB" string, falling back to neon cyan.
  init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var value: UInt64 = 0
    guard Scanner(string: cleaned).scanHexInt64(&value), cleaned.count == 6 else {
      self = Color(red: 0, green: 1, blue: 1)
      return
    }
    self = Color(
      red: Double((value & 0xFF0000) >> 16) / 255.0,
      green: Double((value & 0x00FF00) >> 8) / 255.0,
      blue: Double(value & 0x0000FF) / 255.0
    )
  }
}
