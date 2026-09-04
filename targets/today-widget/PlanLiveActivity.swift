import ActivityKit
import SwiftUI
import WidgetKit

/**
 * Live Activity for the plan that is running right now.
 *
 * A Live Activity is meant for something time-bounded and in progress, which
 * is exactly what a plan is: it has a start, an end, and it is happening. The
 * relationship counters are a poor fit by contrast — a countdown measured in
 * months cannot live inside the few hours ActivityKit allows, and it already
 * has a home screen widget.
 */
@available(iOS 16.2, *)
struct PlanLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PlanActivityAttributes.self) { context in
      LockScreenView(state: context.state)
        .activityBackgroundTint(Color(hex: "#0B0B10"))
        .activitySystemActionForegroundColor(Color(hex: "#00FFFF"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Circle()
            .fill(Color(hex: context.state.colorHex))
            .frame(width: 10, height: 10)
            .padding(.leading, 4)
        }

        DynamicIslandExpandedRegion(.trailing) {
          Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
            .font(.system(size: 14, weight: .semibold, design: .rounded))
            .foregroundColor(Color(hex: "#00FFFF"))
            .frame(width: 56)
            .multilineTextAlignment(.trailing)
        }

        DynamicIslandExpandedRegion(.center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.state.who)
              .font(.system(size: 11, weight: .bold))
              .foregroundColor(.secondary)
            Text(context.state.title)
              .font(.system(size: 15, weight: .bold))
              .foregroundColor(.primary)
              .lineLimit(1)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }

        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false) {
            EmptyView()
          } currentValueLabel: {
            EmptyView()
          }
          .tint(Color(hex: context.state.colorHex))
        }
      } compactLeading: {
        Circle()
          .fill(Color(hex: context.state.colorHex))
          .frame(width: 8, height: 8)
      } compactTrailing: {
        Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundColor(Color(hex: "#00FFFF"))
          .frame(width: 44)
      } minimal: {
        Circle()
          .fill(Color(hex: context.state.colorHex))
          .frame(width: 8, height: 8)
      }
      .keylineTint(Color(hex: context.state.colorHex))
    }
  }
}

@available(iOS 16.2, *)
private struct LockScreenView: View {
  let state: PlanActivityAttributes.ContentState

  var body: some View {
    HStack(spacing: 12) {
      RoundedRectangle(cornerRadius: 2)
        .fill(Color(hex: state.colorHex))
        .frame(width: 4, height: 42)

      VStack(alignment: .leading, spacing: 3) {
        Text(state.who.uppercased())
          .font(.system(size: 10, weight: .bold))
          .foregroundColor(Color(hex: state.isPartner ? "#FF007F" : "#00FFFF"))

        Text(state.title)
          .font(.system(size: 16, weight: .bold))
          .foregroundColor(.white)
          .lineLimit(1)

        ProgressView(timerInterval: state.startedAt...state.endsAt, countsDown: false) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
        .tint(Color(hex: state.colorHex))
        .frame(height: 4)
      }

      Spacer(minLength: 4)

      VStack(alignment: .trailing, spacing: 2) {
        Text(timerInterval: state.startedAt...state.endsAt, countsDown: true)
          .font(.system(size: 17, weight: .bold, design: .rounded))
          .foregroundColor(Color(hex: "#00FFFF"))
          .multilineTextAlignment(.trailing)
          .frame(width: 68)

        Text(state.endsAt, style: .time)
          .font(.system(size: 10))
          .foregroundColor(.secondary)
      }
    }
    .padding(14)
  }
}
