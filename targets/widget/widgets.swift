import WidgetKit
import SwiftUI

struct AtoCardEntry: TimelineEntry {
  let date: Date
  let read: String
  let doText: String
  let hasCard: Bool
}

struct AtoCardProvider: TimelineProvider {
  func placeholder(in context: Context) -> AtoCardEntry {
    AtoCardEntry(
      date: Date(),
      read: "Your Read",
      doText: "Your Do",
      hasCard: true
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (AtoCardEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AtoCardEntry>) -> Void) {
    let entry = loadEntry()
    completion(Timeline(entries: [entry], policy: .never))
  }

  private func loadEntry() -> AtoCardEntry {
    let defaults = UserDefaults(suiteName: "group.com.emgens.ato")
    let read = defaults?.string(forKey: "read") ?? ""
    let doText = defaults?.string(forKey: "do") ?? ""
    let hasCard = defaults?.string(forKey: "hasCard") == "1" && !read.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    return AtoCardEntry(date: Date(), read: read, doText: doText, hasCard: hasCard)
  }
}

struct AtoCardView: View {
  var entry: AtoCardEntry

  var body: some View {
    if entry.hasCard {
      VStack(alignment: .leading, spacing: 8) {
        Text("SAGE · COACH")
          .font(.caption)
          .fontWeight(.semibold)
          .foregroundStyle(.secondary)
        Text("READ")
          .font(.caption)
          .fontWeight(.semibold)
          .foregroundStyle(.secondary)
        Text(entry.read)
          .font(.body)
          .lineLimit(4)
        Text("DO")
          .font(.caption)
          .fontWeight(.semibold)
          .foregroundStyle(.secondary)
          .padding(.top, 4)
        Text(entry.doText)
          .font(.body)
          .lineLimit(4)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    } else {
      VStack(alignment: .leading, spacing: 8) {
        Text("ATO")
          .font(.headline)
        Text("No card yet. Open ATO when you’re ready.")
          .font(.body)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}

struct AtoCard: Widget {
  let kind: String = "AtoCard"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AtoCardProvider()) { entry in
      AtoCardView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
        .widgetURL(URL(string: "ato:///"))
    }
    .configurationDisplayName("ATO")
    .description("Today’s Read and Do.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
