import Foundation

struct HarnmuxTask: Codable, Identifiable, Sendable {
    let id: String
    let role: String
    let requestId: String?
    let mode: String?
    let goal: String?
    let context: String?
    let duty: String?
    let directory: String?
    let nextAction: String?
    let deliveryCurrent: Bool?
    let resultTruncated: Bool?
    let autoReport: Bool?
    let parentId: String?
    let entry: String
    let profile: String
    let harness: String
    let requestedModel: String?
    let actualModel: String?
    let instructions: String
    let state: String
    let worktree: String?
    let nativeSessionId: String?
    let result: String?
    let error: String?
    let updatedAt: String
    let unread: Bool
    let turn: Int
    let acceptanceCriteria: [String]?
    let deliveryDigest: String?
    let leaderReview: ReviewReceipt?
    let acceptance: ReviewReceipt?
    let delivery: Delivery?
    struct Delivery: Codable, Sendable {
        let diff: String
        let status: String
        let truncated: Bool
    }
    var active: Bool { !["completed", "failed", "cancelled", "interrupted"].contains(state) }
    var title: String { (goal ?? instructions).components(separatedBy: .newlines).first ?? instructions }
    var isConversation: Bool { mode == "conversation" || (mode == nil && worktree == nil && directory != nil) }
    var canAccept: Bool { state == "completed" && deliveryCurrent != false && resultTruncated != true && (isConversation ? !(result ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty : delivery != nil && delivery?.truncated != true) }
    var stateLabel: String {
        switch state {
        case "preparing": "准备目录"
        case "running": "执行中"
        case "waiting_approval": "等待审批"
        case "cancelling": "取消中"
        case "completed": acceptance?.decision == "accept" ? "交付已确认" : acceptance?.decision == "request_changes" ? "执行完成 · 需修改" : "结果就绪 · 待审阅"
        case "failed": "失败"
        case "cancelled": "已取消"
        case "interrupted": "已中断 · 需核查"
        default: "状态未知"
        }
    }
}
struct ReviewReceipt: Codable, Sendable {
    let turn: Int
    let digest: String
    let decision: String
    let note: String
    let at: String
    var label: String {
        switch decision {
        case "accept": "已验收快照"
        case "recommend_accept": "建议验收"
        default: "要求修改"
        }
    }
}
struct TaskList: Codable { let tasks: [HarnmuxTask] }
struct TaskDetail: Decodable, Sendable {
    let task: HarnmuxTask
    let approvals: [HarnmuxApproval]
    let events: [HarnmuxEvent]
    let children: [HarnmuxTask]
    var finalizing: Bool? = nil
    var reports: [ResultReport]? = nil
}
struct HarnmuxEvent: Decodable, Sendable, Identifiable {
    let seq: Int
    var id: Int { seq }
    let kind: String
    let data: JSONValue
    let at: String
}
struct HarnmuxApproval: Decodable, Identifiable, Sendable {
    let id: String
    let taskId: String
    let method: String
    let details: JSONValue
    let options: [Option]
    let state: String
    struct Option: Decodable, Identifiable, Sendable {
        let id: String
        let label: String
    }
}
indirect enum JSONValue: Codable, Sendable {
    case object([String: JSONValue]), array([JSONValue]), string(String), number(Double), bool(Bool), null
    init(from decoder: any Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    func encode(to encoder: any Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        }
    }
    var pretty: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? String(data: encoder.encode(self), encoding: .utf8)) ?? "暂无详情"
    }
}

struct ResultReport: Decodable, Identifiable, Sendable {
    let id: String
    let childId: String
    let childTurn: Int
    let state: String
    let reason: String?
    var label: String {
        switch state {
        case "pending": "等待 Leader 接收"
        case "starting": "正在向 Leader 回报"
        case "delivered": "Leader 已接收"
        case "observed": "Leader 已查阅"
        default: "接收情况待核查"
        }
    }
}
struct HarnessProfile: Decodable, Sendable {
    let harness: String
    let model: String?
    var label: String { "\(harness) · \(model ?? "原生默认模型")" }
}
struct Capabilities: Decodable { let profiles: [String: HarnessProfile] }
