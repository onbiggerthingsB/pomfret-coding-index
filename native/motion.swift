import Foundation
import IOKit
import IOKit.hid
import Network

// This foreground helper reads the Apple Silicon HID motion devices. The HID
// report layout is undocumented and may vary across hardware or macOS releases.
let port: UInt16 = 3918
let allowedOrigins: Set<String> = [
    "https://pomfret-coding-index.vercel.app",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
]

func diagnostic(_ message: String) {
    FileHandle.standardError.write(Data((message + "\n").utf8))
}

func monotonicTime() -> TimeInterval {
    ProcessInfo.processInfo.systemUptime
}

struct MotionSample {
    let acceleration: [Double]
    let lid: Int?
    let sequence: Int

    var eventData: Data {
        let payload: [String: Any] = [
            "a": acceleration,
            "lid": lid.map { $0 as Any } ?? NSNull(),
            "sequence": sequence,
        ]
        let json = try! JSONSerialization.data(withJSONObject: payload)
        var event = Data("data: ".utf8)
        event.append(json)
        event.append(Data("\n\n".utf8))
        return event
    }
}

final class MotionReader {
    private struct PropertyChange {
        let service: io_registry_entry_t
        let key: CFString
        let previousValue: CFTypeRef
    }

    private let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
    private var changes: [PropertyChange] = []
    private var stopped = false
    private var total = [0.0, 0.0, 0.0]
    private var cumulativeTotal = [0.0, 0.0, 0.0]
    private var pendingReports = 0
    private var sequence = 0
    private var lidAngle: Int?
    private(set) var sampleCount = 0
    private(set) var matchedDevices = 0
    private(set) var lastReportAt: TimeInterval?
    private(set) var latestSample: MotionSample?
    private(set) var lastAcceleration: [Double]?

    var meanAcceleration: [Double]? {
        sampleCount > 0 ? cumulativeTotal.map { $0 / Double(sampleCount) } : nil
    }

    private func usage(_ device: IOHIDDevice) -> (Int, Int) {
        let page = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsagePageKey as CFString) as? Int ?? 0
        let usage = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsageKey as CFString) as? Int ?? 0
        return (page, usage)
    }

    // Return one retained ancestor belonging to this matched motion device.
    private func reportingService(for device: IOHIDDevice) -> io_registry_entry_t? {
        var current = IOHIDDeviceGetService(device)
        guard current != 0 else { return nil }
        IOObjectRetain(current)
        for _ in 0..<8 {
            if IOObjectConformsTo(current, "AppleSPUHIDDriver") != 0 {
                return current
            }
            var parent: io_registry_entry_t = 0
            let result = IORegistryEntryGetParentEntry(current, kIOServicePlane, &parent)
            IOObjectRelease(current)
            guard result == KERN_SUCCESS, parent != 0 else { return nil }
            current = parent
        }
        IOObjectRelease(current)
        return nil
    }

    private func enableReporting(on devices: Set<IOHIDDevice>) {
        var visited: Set<UInt64> = []
        for device in devices {
            guard let service = reportingService(for: device) else { continue }
            defer { IOObjectRelease(service) }
            var identifier: UInt64 = 0
            guard IORegistryEntryGetRegistryEntryID(service, &identifier) == KERN_SUCCESS,
                  visited.insert(identifier).inserted else { continue }
            let settings = [
                ("SensorPropertyReportingState", 1),
                ("SensorPropertyPowerState", 1),
            ]
            for (name, value) in settings {
                let key = name as CFString
                // A setting is changed only when its previous value can be
                // restored. This avoids guessing defaults for an unknown device.
                guard let previous = IORegistryEntryCreateCFProperty(service, key, kCFAllocatorDefault, 0)?.takeRetainedValue() else { continue }
                let desired = value as CFNumber
                if CFEqual(previous, desired) { continue }
                if IORegistryEntrySetCFProperty(service, key, desired) == KERN_SUCCESS {
                    IOObjectRetain(service)
                    changes.append(PropertyChange(service: service, key: key, previousValue: previous))
                }
            }
        }
    }

    func start() throws {
        let matches = [
            [kIOHIDDeviceUsagePageKey: 0xFF00, kIOHIDDeviceUsageKey: 3],
            [kIOHIDDeviceUsagePageKey: 0x20, kIOHIDDeviceUsageKey: 138],
        ]
        IOHIDManagerSetDeviceMatchingMultiple(manager, matches as CFArray)
        IOHIDManagerRegisterInputReportCallback(manager, { context, result, sender, _, _, bytes, length in
            guard result == kIOReturnSuccess, let context, let sender else { return }
            let reader = Unmanaged<MotionReader>.fromOpaque(context).takeUnretainedValue()
            let device = Unmanaged<IOHIDDevice>.fromOpaque(sender).takeUnretainedValue()
            reader.receive(device: device, bytes: bytes, length: length)
        }, Unmanaged.passUnretained(self).toOpaque())
        IOHIDManagerScheduleWithRunLoop(manager, CFRunLoopGetMain(), CFRunLoopMode.defaultMode.rawValue)
        let result = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        guard result == kIOReturnSuccess else {
            throw HelperError("The motion devices could not be opened (\(String(format: "0x%08x", result))). macOS may require additional permission or administrator access.")
        }
        let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice> ?? []
        matchedDevices = devices.count
        guard devices.contains(where: { usage($0) == (0xFF00, 3) }) else {
            throw HelperError("No supported Apple Silicon accelerometer was found on this Mac.")
        }
        enableReporting(on: devices)
        diagnostic("Opened \(matchedDevices) motion device(s). Waiting for fresh accelerometer reports.")
    }

    private func receive(device: IOHIDDevice, bytes: UnsafeMutablePointer<UInt8>, length: CFIndex) {
        guard !stopped else { return }
        let (page, deviceUsage) = usage(device)
        if page == 0xFF00, deviceUsage == 3, length >= 18 {
            let acceleration = [6, 10, 14].map { offset -> Double in
                var raw: Int32 = 0
                memcpy(&raw, bytes + offset, 4)
                return Double(Int32(littleEndian: raw)) / 65_536.0
            }
            let magnitude = sqrt(acceleration.reduce(0) { $0 + $1 * $1 })
            guard magnitude.isFinite, magnitude > 0.05, magnitude < 8 else { return }
            let now = monotonicTime()
            if let lastReportAt, now - lastReportAt >= 0.5 {
                total = [0, 0, 0]
                pendingReports = 0
            }
            for axis in 0..<3 {
                total[axis] += acceleration[axis]
                cumulativeTotal[axis] += acceleration[axis]
            }
            pendingReports += 1
            sampleCount += 1
            lastAcceleration = acceleration
            lastReportAt = now
        } else if page == 0x20, deviceUsage == 138, length >= 3 {
            let angle = Int(UInt16(bytes[1]) | (UInt16(bytes[2]) << 8)) & 0x1FF
            lidAngle = (30...170).contains(angle) ? angle : nil
        }
    }

    func takeSample() -> MotionSample? {
        guard pendingReports > 0, let lastReportAt, monotonicTime() - lastReportAt < 0.5 else { return nil }
        sequence += 1
        let acceleration = total.map { $0 / Double(pendingReports) }
        total = [0, 0, 0]
        pendingReports = 0
        let sample = MotionSample(acceleration: acceleration, lid: lidAngle, sequence: sequence)
        latestSample = sample
        return sample
    }

    func stop() {
        guard !stopped else { return }
        stopped = true
        for change in changes.reversed() {
            if IORegistryEntrySetCFProperty(change.service, change.key, change.previousValue) != KERN_SUCCESS {
                diagnostic("Could not restore motion property \(change.key).")
            }
            IOObjectRelease(change.service)
        }
        changes.removeAll()
        IOHIDManagerClose(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        IOHIDManagerUnscheduleFromRunLoop(manager, CFRunLoopGetMain(), CFRunLoopMode.defaultMode.rawValue)
    }
}

struct HelperError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

final class MotionServer {
    private final class Client {
        let connection: NWConnection
        let acceptedAt = monotonicTime()
        var header = Data()
        var streaming = false
        var sendingSince: TimeInterval?

        init(_ connection: NWConnection) { self.connection = connection }
    }

    private let listener: NWListener
    private var clients: [UUID: Client] = [:]
    private let maximumHeaders = 8_192

    init() throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        listener = try NWListener(using: parameters)
    }

    func start(onFailure: @escaping (String) -> Void) {
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                diagnostic("Motion helper listening at http://127.0.0.1:\(port)/motion. Press Control-C to stop.")
            case .failed(let error):
                onFailure("Cannot start the local motion server. \(error)")
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { connection.cancel(); return }
            guard self.clients.count < 8 else { connection.cancel(); return }
            let identifier = UUID()
            let client = Client(connection)
            self.clients[identifier] = client
            connection.stateUpdateHandler = { [weak self] state in
                if case .failed = state { self?.close(identifier) }
                if case .cancelled = state { self?.clients.removeValue(forKey: identifier) }
            }
            connection.start(queue: .main)
            self.readHeaders(identifier)
        }
        listener.start(queue: .main)
    }

    private func close(_ identifier: UUID) {
        clients.removeValue(forKey: identifier)?.connection.cancel()
    }

    private func readHeaders(_ identifier: UUID) {
        guard let client = clients[identifier] else { return }
        client.connection.receive(minimumIncompleteLength: 1, maximumLength: maximumHeaders + 1) { [weak self] data, _, complete, error in
            guard let self, self.clients[identifier] != nil else { return }
            if let data { client.header.append(data) }
            if client.header.count > self.maximumHeaders {
                self.respond(identifier, status: "431 Request Header Fields Too Large")
            } else if let boundary = client.header.range(of: Data("\r\n\r\n".utf8)) {
                guard boundary.upperBound == client.header.endIndex else {
                    self.respond(identifier, status: "400 Bad Request")
                    return
                }
                self.handle(identifier, header: client.header)
            } else if complete || error != nil {
                self.close(identifier)
            } else {
                self.readHeaders(identifier)
            }
        }
    }

    private func handle(_ identifier: UUID, header: Data) {
        guard let text = String(data: header, encoding: .utf8) else {
            respond(identifier, status: "400 Bad Request")
            return
        }
        let lines = text.components(separatedBy: "\r\n")
        let request = lines[0].split(separator: " ", omittingEmptySubsequences: false)
        guard request.count == 3, ["HTTP/1.0", "HTTP/1.1"].contains(String(request[2])), lines.count <= 67 else {
            respond(identifier, status: "400 Bad Request")
            return
        }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() where !line.isEmpty {
            guard let colon = line.firstIndex(of: ":") else {
                respond(identifier, status: "400 Bad Request")
                return
            }
            let name = String(line[..<colon]).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty, name.utf8.allSatisfy({ (97...122).contains($0) || $0 == 45 }), headers[name] == nil,
                  !value.contains("\n"), !value.contains("\r") else {
                respond(identifier, status: "400 Bad Request")
                return
            }
            headers[name] = value
        }
        guard ["127.0.0.1:\(port)", "localhost:\(port)"].contains(headers["host"] ?? ""),
              headers["transfer-encoding"] == nil,
              headers["content-length"] == nil || headers["content-length"] == "0" else {
            respond(identifier, status: "400 Bad Request")
            return
        }
        let origin = headers["origin"]
        if let origin {
            guard allowedOrigins.contains(origin) else {
                respond(identifier, status: "403 Forbidden")
                return
            }
        } else if let site = headers["sec-fetch-site"], site != "none" {
            respond(identifier, status: "403 Forbidden")
            return
        }
        guard request[1] == "/motion" else {
            respond(identifier, status: "404 Not Found", origin: origin)
            return
        }
        if request[0] == "OPTIONS" {
            guard headers["access-control-request-method"] == "GET" else {
                respond(identifier, status: "405 Method Not Allowed", origin: origin)
                return
            }
            let requestedHeaders = (headers["access-control-request-headers"] ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            guard requestedHeaders.allSatisfy({ ["accept", "cache-control", "last-event-id"].contains($0) }) else {
                respond(identifier, status: "403 Forbidden", origin: origin)
                return
            }
            respond(identifier, status: "204 No Content", origin: origin, extra: "Access-Control-Allow-Methods: GET, OPTIONS\r\nAccess-Control-Allow-Headers: Accept, Cache-Control, Last-Event-ID\r\nAccess-Control-Max-Age: 600\r\n")
        } else if request[0] == "GET" {
            guard clients.values.filter({ $0.streaming }).count < 4 else {
                respond(identifier, status: "503 Service Unavailable", origin: origin)
                return
            }
            beginStream(identifier, origin: origin)
        } else {
            respond(identifier, status: "405 Method Not Allowed", origin: origin, extra: "Allow: GET, OPTIONS\r\n")
        }
    }

    private func corsHeaders(_ origin: String?) -> String {
        guard let origin else { return "" }
        return "Access-Control-Allow-Origin: \(origin)\r\nVary: Origin\r\nAccess-Control-Allow-Private-Network: true\r\n"
    }

    private func respond(_ identifier: UUID, status: String, origin: String? = nil, extra: String = "") {
        guard let client = clients[identifier] else { return }
        let response = "HTTP/1.1 \(status)\r\nContent-Length: 0\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\(corsHeaders(origin))\(extra)\r\n"
        client.sendingSince = monotonicTime()
        client.connection.send(content: Data(response.utf8), completion: .contentProcessed { [weak self] _ in self?.close(identifier) })
    }

    private func beginStream(_ identifier: UUID, origin: String?) {
        guard let client = clients[identifier] else { return }
        // Reserve the slot before the header finishes sending.
        client.streaming = true
        client.header.removeAll()
        client.sendingSince = monotonicTime()
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nConnection: keep-alive\r\nX-Content-Type-Options: nosniff\r\n\(corsHeaders(origin))\r\n"
        client.connection.send(content: Data(response.utf8), completion: .contentProcessed { [weak self] error in
            guard let self, self.clients[identifier] != nil else { return }
            if error != nil { self.close(identifier); return }
            client.sendingSince = nil
            // A stream accepts only one request. This also notices a closed tab.
            client.connection.receive(minimumIncompleteLength: 1, maximumLength: 1) { [weak self] _, _, _, _ in self?.close(identifier) }
        })
    }

    func broadcast(_ sample: MotionSample) {
        let data = sample.eventData
        for (identifier, client) in clients where client.streaming && client.sendingSince == nil {
            client.sendingSince = monotonicTime()
            client.connection.send(content: data, completion: .contentProcessed { [weak self] error in
                guard let self, self.clients[identifier] != nil else { return }
                if error != nil { self.close(identifier) } else { client.sendingSince = nil }
            })
        }
    }

    func expireSlowClients() {
        let now = monotonicTime()
        let expired = clients.compactMap { identifier, client -> UUID? in
            if !client.streaming && now - client.acceptedAt > 5 { return identifier }
            if let sendingSince = client.sendingSince, now - sendingSince > 5 { return identifier }
            return nil
        }
        expired.forEach(close)
    }

    func stop() {
        listener.cancel()
        let connections = clients.values.map(\.connection)
        clients.removeAll()
        connections.forEach { $0.cancel() }
    }
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.isEmpty || arguments == ["--probe"] else {
    diagnostic("Usage: motion [--probe]")
    exit(64)
}
let probe = arguments == ["--probe"]
let reader = MotionReader()
var server: MotionServer?
var timer: Timer?
var terminating = false

func finish(_ code: Int32) -> Never {
    if !terminating {
        terminating = true
        timer?.invalidate()
        server?.stop()
        reader.stop()
    }
    exit(code)
}

var signalSources: [DispatchSourceSignal] = []
for signalNumber in [SIGINT, SIGTERM, SIGHUP] {
    signal(signalNumber, SIG_IGN)
    let source = DispatchSource.makeSignalSource(signal: signalNumber, queue: .main)
    source.setEventHandler { finish(0) }
    source.resume()
    signalSources.append(source)
}

do {
    try reader.start()
    if !probe {
        server = try MotionServer()
        server?.start { message in diagnostic(message); finish(1) }
    }
} catch {
    diagnostic(String(describing: error))
    finish(2)
}

let startedAt = monotonicTime()
var announced = false
timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { _ in
    if let sample = reader.takeSample() {
        if !announced {
            announced = true
            diagnostic("Fresh accelerometer data is available.")
        }
        server?.broadcast(sample)
    }
    server?.expireSlowClients()
    let now = monotonicTime()
    let fresh = reader.lastReportAt.map { now - $0 < 0.5 } ?? false
    if probe && now - startedAt >= 5 {
        var result: [String: Any] = ["matchedDevices": reader.matchedDevices, "samples": reader.sampleCount, "fresh": fresh]
        if let sample = reader.latestSample { result["a"] = sample.acceleration }
        if let mean = reader.meanAcceleration { result["meanAcceleration"] = mean }
        if let last = reader.lastAcceleration { result["lastAcceleration"] = last }
        let json = try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        FileHandle.standardOutput.write(json)
        FileHandle.standardOutput.write(Data("\n".utf8))
        if !fresh { diagnostic("No fresh accelerometer data. This hardware may be unsupported or require additional macOS permission or administrator access.") }
        finish(fresh ? 0 : 2)
    }
    let lastReport = reader.lastReportAt ?? startedAt
    if !probe && now - lastReport >= 5 {
        diagnostic("Accelerometer data is unavailable. The helper is stopping. Check hardware support and macOS permissions before retrying.")
        finish(2)
    }
}
RunLoop.main.run()
