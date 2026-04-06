//
//  TimesheetsViewController.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class TimesheetsViewController: UIViewController {

    // MARK: - State

    private var timeEntries: [TimeEntry] = []

    // MARK: - Subviews

    private let tableView  = UITableView(frame: .zero, style: .plain)
    private let emptyLabel = UILabel()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Time Entries"
        view.backgroundColor = .systemBackground
        setupTableView()
        setupEmptyLabel()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        NotificationCenter.default.addObserver(self,
            selector: #selector(onDataChange),
            name: .didUpdateTimeEntries,
            object: nil)
        loadEntries()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        NotificationCenter.default.removeObserver(self, name: .didUpdateTimeEntries, object: nil)
    }

    // MARK: - Setup

    private func setupTableView() {
        tableView.register(TimeEntryTableViewCell.self, forCellReuseIdentifier: "TimeEntryCell")
        tableView.dataSource          = self
        tableView.delegate            = self
        tableView.rowHeight           = UITableView.automaticDimension
        tableView.estimatedRowHeight  = 72
        tableView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tableView)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: safe.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
        ])
    }

    private func setupEmptyLabel() {
        emptyLabel.text          = "No time entries yet.\nStart tracking on the Time Card tab."
        emptyLabel.font          = UIFont.systemFont(ofSize: 16)
        emptyLabel.textColor     = .secondaryLabel
        emptyLabel.textAlignment = .center
        emptyLabel.numberOfLines = 0
        emptyLabel.isHidden      = true
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            emptyLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            emptyLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
        ])
    }

    // MARK: - Data

    private func loadEntries() {
        timeEntries = DataManager.shared.fetchAllEntries()
        emptyLabel.isHidden = !timeEntries.isEmpty
        tableView.reloadData()
    }

    @objc private func onDataChange() { loadEntries() }

    // MARK: - Edit

    private func showEditEntry(_ entry: TimeEntry) {
        let editVC = EditTimeEntryViewController(entry: entry)
        editVC.modalPresentationStyle = .pageSheet
        present(editVC, animated: true)
    }
}

// MARK: - UITableViewDataSource

extension TimesheetsViewController: UITableViewDataSource {

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        timeEntries.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "TimeEntryCell", for: indexPath) as! TimeEntryTableViewCell
        cell.configure(with: timeEntries[indexPath.row])
        return cell
    }

    func tableView(_ tableView: UITableView, commit editingStyle: UITableViewCell.EditingStyle, forRowAt indexPath: IndexPath) {
        guard editingStyle == .delete else { return }
        let entry = timeEntries[indexPath.row]
        DataManager.shared.deleteEntry(entry)
        timeEntries.remove(at: indexPath.row)
        tableView.deleteRows(at: [indexPath], with: .fade)
        emptyLabel.isHidden = !timeEntries.isEmpty
    }
}

// MARK: - UITableViewDelegate

extension TimesheetsViewController: UITableViewDelegate {

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        showEditEntry(timeEntries[indexPath.row])
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        timeEntries.isEmpty ? nil : "ALL ENTRIES"
    }
}
