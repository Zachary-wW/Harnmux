import Foundation
import SwiftUI
import AppKit

@MainActor
final class HarnmuxModel: ObservableObject {
    @Published var tasks: [HarnmuxTask] = []
    @Published var detail: TaskDetail?
    @Published var selected: String?
    @Published var connectionError: String? = "正在连接本地服务…"
    @Published var operationError: String?
    @Published var busy = false
    @Published var lastRefresh: Date?
    private var refreshing = false
    private var poller: Task<Void, Never>?
    init() {
        if let data = try? Data(contentsOf: home.appendingPathComponent("ui-cache.json")),
           let saved = try? JSONDecoder().decode(TaskList.self, from: data) { tasks = saved.tasks }
        poller = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                do { try await Task.sleep(for: .seconds(2)) } catch { break }
            }
        }
    }
    deinit { poller?.cancel() }

    var home: URL {
        if let path = ProcessInfo.processInfo.environment["HARNMUX_HOME"] {
            return URL(fileURLWithPath: path)
        }
        return FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".harnmux")
    }
    var pending: Int { tasks.filter { $0.state == "waiting_approval" }.count }
    var running: Int { tasks.filter { $0.active && $0.state != "waiting_approval" }.count }
    var unread: Int { tasks.filter(\.unread).count }
    var statusText: String { pending > 0 ? "\(pending) 待处理" : running > 0 ? "\(running) 运行中" : unread > 0 ? "\(unread) 条结果" : "" }

    private func request(_ path: String, body: [String: JSONValue]? = nil) async throws -> Data {
        let endpoint = try Data(contentsOf: home.appendingPathComponent("endpoint.json"))
        let info = try JSONDecoder().decode(Endpoint.self, from: endpoint)
        guard let base = URL(string: info.url), base.scheme == "http", base.host == "127.0.0.1",
              let url = URL(string: path, relativeTo: base) else { throw ClientError("本地服务地址无效") }
        let token = try String(contentsOf: home.appendingPathComponent("token"), encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
        var req = URLRequest(url: url, timeoutInterval: 8)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let error = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw ClientError(error?.error ?? "本地服务请求失败")
        }
        return data
    }
    func refresh() async {
        guard !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        do {
            let list = try JSONDecoder().decode(TaskList.self, from: await request("/v1/tasks"))
            tasks = list.tasks
            if let cache = try? JSONEncoder().encode(list) {
                let path = home.appendingPathComponent("ui-cache.json")
                try? cache.write(to: path, options: .atomic)
                try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path.path)
            }
            if let selected {
                detail = try JSONDecoder().decode(TaskDetail.self, from: await request("/v1/tasks/\(selected)"))
            }
            connectionError = nil
            lastRefresh = Date()
        } catch {
            if !Task.isCancelled { connectionError = "服务未连接，显示上次数据。请启动 harnmux serve。" }
        }
    }
    func select(_ id: String) async {
        selected = id; detail = nil; operationError = nil
        await refresh()
        if selected == id, detail == nil, let cached = tasks.first(where: { $0.id == id }) {
            detail = TaskDetail(task: cached, approvals: [], events: [], children: tasks.filter { $0.parentId == id })
        }
    }
    func perform(_ path: String, body: [String: JSONValue] = [:]) async {
        guard !busy else { return }
        busy = true; operationError = nil
        defer { busy = false }
        do { _ = try await request(path, body: body); await refresh() }
        catch { operationError = error.localizedDescription }
    }
    func copyPacket(_ task: HarnmuxTask) async {
        guard !busy else { return }
        busy = true; operationError = nil
        defer { busy = false }
        do {
            let data = try await request("/v1/tasks/\(task.id)/packet?turn=\(task.turn)")
            copy(String(decoding: data, as: UTF8.self))
        } catch { operationError = error.localizedDescription }
    }
    func reveal(_ path: String) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }
    func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
    private struct Endpoint: Decodable { let url: String }
    private struct ErrorResponse: Decodable { let error: String }
    private struct ClientError: LocalizedError { let message: String; init(_ message: String) { self.message = message }; var errorDescription: String? { message } }
}
