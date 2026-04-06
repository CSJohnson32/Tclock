//
//  TimeCardViewController.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class TimeCardViewController: UIViewController {

    // MARK: - State

    private var allProjects:      [Project]   = []
    private var filteredProjects: [Project]   = []
    private var activeEntry:      TimeEntry?
    private var displayTimer:     Timer?
    private var selectedWindow:   TimeWindow  = .today

    enum TimeWindow: Int {
        case today = 0, thisWeek, thisMonth, allTime

        var title: String {
            switch self {
            case .today:     return "Today"
            case .thisWeek:  return "Week"
            case .thisMonth: return "Month"
            case .allTime:   return "All"
            }
        }

        func dateRange() -> (start: Date, end: Date) {
            let cal = Calendar.current
            let now = Date()
            switch self {
            case .today:
                return (cal.startOfDay(for: now), now)
            case .thisWeek:
                let start = cal.date(from: cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now))
                    ?? cal.startOfDay(for: now)
                return (start, now)
            case .thisMonth:
                let start = cal.date(from: cal.dateComponents([.year, .month], from: now))
                    ?? cal.startOfDay(for: now)
                return (start, now)
            case .allTime:
                return (.distantPast, now)
            }
        }
    }

    // MARK: - Subviews

    private let headerView          = UIView()
    private let projectHeadingLabel = UILabel()
    private let projectNameLabel    = UILabel()
    private let elapsedTimeLabel    = UILabel()
    private let clockButton         = UIButton(type: .system)
    private let windowControl       = UISegmentedControl()
    private let totalTimeLabel      = UILabel()
    private let searchBar           = UISearchBar()
    private let tableView           = UITableView(frame: .zero, style: .plain)
    private let separatorLine       = UIView()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
        layoutUI()
        tableView.register(ProjectTableViewCell.self, forCellReuseIdentifier: "ProjectCell")
        tableView.dataSource = self
        tableView.delegate   = self
        searchBar.delegate   = self
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(onDataChange),    name: .didUpdateTimeEntries,  object: nil)
        nc.addObserver(self, selector: #selector(onDataChange),    name: .didUpdateProjects,     object: nil)
        nc.addObserver(self, selector: #selector(onForeground),    name: .appDidEnterForeground, object: nil)
        refresh()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        NotificationCenter.default.removeObserver(self)
        stopTimer()
    }

    // MARK: - Build UI

    private func buildUI() {
        view.backgroundColor = .systemBackground

        // ---- Header ----
        headerView.backgroundColor = .systemBackground
        headerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerView)

        projectHeadingLabel.text      = "CURRENT PROJECT"
        projectHeadingLabel.font      = UIFont.systemFont(ofSize: 11, weight: .semibold)
        projectHeadingLabel.textColor = .secondaryLabel
        projectHeadingLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(projectHeadingLabel)

        projectNameLabel.text      = "No project selected"
        projectNameLabel.font      = UIFont.systemFont(ofSize: 20, weight: .semibold)
        projectNameLabel.textColor = .label
        projectNameLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(projectNameLabel)

        elapsedTimeLabel.text          = "00:00:00"
        elapsedTimeLabel.font          = UIFont.monospacedDigitSystemFont(ofSize: 46, weight: .thin)
        elapsedTimeLabel.textColor     = .label
        elapsedTimeLabel.textAlignment = .center
        elapsedTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(elapsedTimeLabel)

        clockButton.setTitle("Select a project to start", for: .normal)
        clockButton.titleLabel?.font  = UIFont.systemFont(ofSize: 16, weight: .semibold)
        clockButton.backgroundColor   = .systemGray4
        clockButton.setTitleColor(.secondaryLabel, for: .normal)
        clockButton.setTitleColor(.white, for: .disabled)
        clockButton.layer.cornerRadius = 10
        clockButton.translatesAutoresizingMaskIntoConstraints = false
        clockButton.addTarget(self, action: #selector(clockButtonTapped), for: .touchUpInside)
        headerView.addSubview(clockButton)

        let windowItems = [TimeWindow.today, .thisWeek, .thisMonth, .allTime].map(\.title)
        windowItems.enumerated().forEach { windowControl.insertSegment(withTitle: $1, at: $0, animated: false) }
        windowControl.selectedSegmentIndex = 0
        windowControl.translatesAutoresizingMaskIntoConstraints = false
        windowControl.addTarget(self, action: #selector(windowChanged), for: .valueChanged)
        headerView.addSubview(windowControl)

        totalTimeLabel.text          = "Total: 0m"
        totalTimeLabel.font          = UIFont.systemFont(ofSize: 14, weight: .regular)
        totalTimeLabel.textColor     = .secondaryLabel
        totalTimeLabel.textAlignment = .center
        totalTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(totalTimeLabel)

        // ---- Separator ----
        separatorLine.backgroundColor = .separator
        separatorLine.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(separatorLine)

        // ---- Search bar ----
        searchBar.placeholder = "Search projects…"
        searchBar.backgroundImage = UIImage()  // remove default borders
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(searchBar)

        // ---- Table view ----
        tableView.rowHeight          = UITableView.automaticDimension
        tableView.estimatedRowHeight = 60
        tableView.separatorInset     = UIEdgeInsets(top: 0, left: 56, bottom: 0, right: 0)
        tableView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tableView)
    }

    private func layoutUI() {
        let safe = view.safeAreaLayoutGuide

        NSLayoutConstraint.activate([
            // Header
            headerView.topAnchor.constraint(equalTo: safe.topAnchor, constant: 8),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            // Project heading
            projectHeadingLabel.topAnchor.constraint(equalTo: headerView.topAnchor),
            projectHeadingLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),

            // Project name
            projectNameLabel.topAnchor.constraint(equalTo: projectHeadingLabel.bottomAnchor, constant: 2),
            projectNameLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            projectNameLabel.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -16),

            // Elapsed time
            elapsedTimeLabel.topAnchor.constraint(equalTo: projectNameLabel.bottomAnchor, constant: 6),
            elapsedTimeLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),

            // Clock button
            clockButton.topAnchor.constraint(equalTo: elapsedTimeLabel.bottomAnchor, constant: 12),
            clockButton.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            clockButton.widthAnchor.constraint(equalToConstant: 240),
            clockButton.heightAnchor.constraint(equalToConstant: 44),

            // Time window segmented control
            windowControl.topAnchor.constraint(equalTo: clockButton.bottomAnchor, constant: 16),
            windowControl.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            windowControl.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -16),

            // Total time label
            totalTimeLabel.topAnchor.constraint(equalTo: windowControl.bottomAnchor, constant: 6),
            totalTimeLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            totalTimeLabel.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -4),

            // Separator
            separatorLine.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            separatorLine.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            separatorLine.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            separatorLine.heightAnchor.constraint(equalToConstant: 0.5),

            // Search bar
            searchBar.topAnchor.constraint(equalTo: separatorLine.bottomAnchor),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            // Table view
            tableView.topAnchor.constraint(equalTo: searchBar.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
        ])
    }

    // MARK: - Data

    private func refresh() {
        allProjects      = DataManager.shared.fetchAllProjects()
        applySearchFilter(text: searchBar.text)
        activeEntry      = DataManager.shared.fetchActiveEntry()
        updateHeaderUI()
        tableView.reloadData()
        activeEntry != nil ? startTimer() : stopTimer()
    }

    @objc private func onDataChange() { refresh() }

    @objc private func onForeground() {
        activeEntry = DataManager.shared.fetchActiveEntry()
        updateHeaderUI()
        updateTotalLabel()
        if activeEntry != nil { startTimer() }
    }

    private func applySearchFilter(text: String?) {
        let q = (text ?? "").trimmingCharacters(in: .whitespaces)
        filteredProjects = q.isEmpty
            ? allProjects
            : allProjects.filter { ($0.name ?? "").localizedCaseInsensitiveContains(q) }
    }

    // MARK: - Timer

    private func startTimer() {
        stopTimer()
        displayTimer = Timer(timeInterval: 1, target: self, selector: #selector(tickTimer), userInfo: nil, repeats: true)
        RunLoop.main.add(displayTimer!, forMode: .common)
        tickTimer()
    }

    private func stopTimer() {
        displayTimer?.invalidate()
        displayTimer = nil
    }

    @objc private func tickTimer() {
        guard let start = activeEntry?.startTime else {
            elapsedTimeLabel.text = "00:00:00"
            return
        }
        elapsedTimeLabel.text = Date().timeIntervalSince(start).formattedAsElapsed()
    }

    // MARK: - Header UI

    private func updateHeaderUI() {
        if let entry = activeEntry, let project = entry.project {
            projectNameLabel.text  = project.name ?? "Unknown"
            clockButton.setTitle("Clock Out", for: .normal)
            clockButton.backgroundColor   = .systemRed
            clockButton.setTitleColor(.white, for: .normal)
            elapsedTimeLabel.textColor = .systemGreen
        } else {
            projectNameLabel.text  = "No project selected"
            elapsedTimeLabel.text  = "00:00:00"
            elapsedTimeLabel.textColor = .label
            clockButton.setTitle("Select a project to start", for: .normal)
            clockButton.backgroundColor   = .systemGray4
            clockButton.setTitleColor(.secondaryLabel, for: .normal)
        }
        updateTotalLabel()
    }

    private func updateTotalLabel() {
        guard let entry = activeEntry, let project = entry.project else {
            totalTimeLabel.text = "Total: 0m"
            return
        }
        let (start, end) = selectedWindow.dateRange()
        let entries = DataManager.shared.fetchEntries(for: project, from: start, to: end)
        let total: TimeInterval = entries.reduce(0) { sum, e in
            guard let s = e.startTime else { return sum }
            return sum + (e.endTime ?? Date()).timeIntervalSince(s)
        }
        totalTimeLabel.text = "Total: \(total.formattedAsSummary())"
    }

    // MARK: - Actions

    @objc private func clockButtonTapped() {
        guard activeEntry != nil else { return }
        DataManager.shared.stopActiveEntry()
        // refresh() is triggered by the didUpdateTimeEntries notification
    }

    @objc private func windowChanged() {
        selectedWindow = TimeWindow(rawValue: windowControl.selectedSegmentIndex) ?? .today
        updateTotalLabel()
        tableView.reloadData()
    }
}

// MARK: - UITableViewDataSource

extension TimeCardViewController: UITableViewDataSource {

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        filteredProjects.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "ProjectCell", for: indexPath) as! ProjectTableViewCell
        let project  = filteredProjects[indexPath.row]
        let isActive = activeEntry?.project == project

        let (start, end) = selectedWindow.dateRange()
        let entries = DataManager.shared.fetchEntries(for: project, from: start, to: end)
        let total: TimeInterval = entries.reduce(0) { sum, e in
            guard let s = e.startTime else { return sum }
            return sum + (e.endTime ?? Date()).timeIntervalSince(s)
        }

        cell.configure(with: project, totalTime: total, isActive: isActive)
        return cell
    }
}

// MARK: - UITableViewDelegate

extension TimeCardViewController: UITableViewDelegate {

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        filteredProjects.isEmpty ? nil : "PROJECTS"
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let project = filteredProjects[indexPath.row]

        // Tapping the already-active project does nothing
        if let current = activeEntry, current.project == project { return }

        // Stop any running entry, start a new one
        DataManager.shared.stopActiveEntry()
        DataManager.shared.createEntry(project: project)
        // refresh() fires via notification
    }
}

// MARK: - UISearchBarDelegate

extension TimeCardViewController: UISearchBarDelegate {

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        applySearchFilter(text: searchText)
        tableView.reloadData()
    }

    func searchBarTextDidBeginEditing(_ searchBar: UISearchBar) {
        searchBar.setShowsCancelButton(true, animated: true)
    }

    func searchBarCancelButtonClicked(_ searchBar: UISearchBar) {
        searchBar.text = ""
        searchBar.resignFirstResponder()
        searchBar.setShowsCancelButton(false, animated: true)
        applySearchFilter(text: nil)
        tableView.reloadData()
    }

    func searchBarTextDidEndEditing(_ searchBar: UISearchBar) {
        searchBar.setShowsCancelButton(false, animated: true)
    }
}
