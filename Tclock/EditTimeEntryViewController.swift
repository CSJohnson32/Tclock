//
//  EditTimeEntryViewController.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class EditTimeEntryViewController: UIViewController {

    // MARK: - Properties

    private let entry: TimeEntry

    // MARK: - Subviews

    private let startPicker  = UIDatePicker()
    private let endPicker    = UIDatePicker()
    private let notesView    = UITextView()
    private let runningLabel = UILabel()

    // MARK: - Init

    init(entry: TimeEntry) {
        self.entry = entry
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        setupToolbar()
        setupScrollContent()
        populateFields()
    }

    // MARK: - Setup

    private func setupToolbar() {
        let toolbar = UIToolbar()
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbar)

        let cancel = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancelTapped))
        let flex   = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
        let save   = UIBarButtonItem(barButtonSystemItem: .save,   target: self, action: #selector(saveTapped))
        toolbar.items = [cancel, flex, save]

        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    private func setupScrollContent() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        let content = UIView()
        content.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(content)

        // --- Start Time card ---
        let startCard = makeCard()
        let startHeading = makeHeading("START TIME")
        startPicker.datePickerMode = .dateAndTime
        if #available(iOS 14.0, *) { startPicker.preferredDatePickerStyle = .compact }
        startPicker.translatesAutoresizingMaskIntoConstraints = false
        startCard.addSubview(startHeading)
        startCard.addSubview(startPicker)
        content.addSubview(startCard)

        // --- End Time card ---
        let endCard = makeCard()
        let endHeading = makeHeading("END TIME")
        endPicker.datePickerMode = .dateAndTime
        if #available(iOS 14.0, *) { endPicker.preferredDatePickerStyle = .compact }
        endPicker.translatesAutoresizingMaskIntoConstraints = false

        runningLabel.text = "Currently running — end time will be set when clocked out"
        runningLabel.font = UIFont.systemFont(ofSize: 13)
        runningLabel.textColor = .systemGreen
        runningLabel.numberOfLines = 0
        runningLabel.translatesAutoresizingMaskIntoConstraints = false

        endCard.addSubview(endHeading)
        endCard.addSubview(endPicker)
        endCard.addSubview(runningLabel)
        content.addSubview(endCard)

        // --- Notes card ---
        let notesCard = makeCard()
        let notesHeading = makeHeading("NOTES")
        notesView.font = UIFont.systemFont(ofSize: 16)
        notesView.backgroundColor = .clear
        notesView.isScrollEnabled = false
        notesView.translatesAutoresizingMaskIntoConstraints = false
        notesCard.addSubview(notesHeading)
        notesCard.addSubview(notesView)
        content.addSubview(notesCard)

        // --- Layout ---
        let safe = view.safeAreaLayoutGuide

        NSLayoutConstraint.activate([
            // Scroll view (below toolbar, 44pt standard toolbar height)
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 44),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            // Content fills scroll view width
            content.topAnchor.constraint(equalTo: scrollView.topAnchor),
            content.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            content.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            content.widthAnchor.constraint(equalTo: scrollView.widthAnchor),

            // Start card
            startCard.topAnchor.constraint(equalTo: content.topAnchor, constant: 20),
            startCard.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 16),
            startCard.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -16),

            startHeading.topAnchor.constraint(equalTo: startCard.topAnchor, constant: 12),
            startHeading.leadingAnchor.constraint(equalTo: startCard.leadingAnchor, constant: 14),

            startPicker.topAnchor.constraint(equalTo: startHeading.bottomAnchor, constant: 6),
            startPicker.leadingAnchor.constraint(equalTo: startCard.leadingAnchor, constant: 14),
            startPicker.bottomAnchor.constraint(equalTo: startCard.bottomAnchor, constant: -12),

            // End card
            endCard.topAnchor.constraint(equalTo: startCard.bottomAnchor, constant: 12),
            endCard.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 16),
            endCard.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -16),

            endHeading.topAnchor.constraint(equalTo: endCard.topAnchor, constant: 12),
            endHeading.leadingAnchor.constraint(equalTo: endCard.leadingAnchor, constant: 14),

            endPicker.topAnchor.constraint(equalTo: endHeading.bottomAnchor, constant: 6),
            endPicker.leadingAnchor.constraint(equalTo: endCard.leadingAnchor, constant: 14),
            endPicker.bottomAnchor.constraint(equalTo: endCard.bottomAnchor, constant: -12),

            runningLabel.topAnchor.constraint(equalTo: endHeading.bottomAnchor, constant: 8),
            runningLabel.leadingAnchor.constraint(equalTo: endCard.leadingAnchor, constant: 14),
            runningLabel.trailingAnchor.constraint(equalTo: endCard.trailingAnchor, constant: -14),
            runningLabel.bottomAnchor.constraint(equalTo: endCard.bottomAnchor, constant: -12),

            // Notes card
            notesCard.topAnchor.constraint(equalTo: endCard.bottomAnchor, constant: 12),
            notesCard.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 16),
            notesCard.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -16),
            notesCard.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -32),

            notesHeading.topAnchor.constraint(equalTo: notesCard.topAnchor, constant: 12),
            notesHeading.leadingAnchor.constraint(equalTo: notesCard.leadingAnchor, constant: 14),

            notesView.topAnchor.constraint(equalTo: notesHeading.bottomAnchor, constant: 6),
            notesView.leadingAnchor.constraint(equalTo: notesCard.leadingAnchor, constant: 10),
            notesView.trailingAnchor.constraint(equalTo: notesCard.trailingAnchor, constant: -10),
            notesView.heightAnchor.constraint(greaterThanOrEqualToConstant: 80),
            notesView.bottomAnchor.constraint(equalTo: notesCard.bottomAnchor, constant: -12),
        ])
    }

    private func makeCard() -> UIView {
        let v = UIView()
        v.backgroundColor = .secondarySystemGroupedBackground
        v.layer.cornerRadius = 10
        v.translatesAutoresizingMaskIntoConstraints = false
        return v
    }

    private func makeHeading(_ text: String) -> UILabel {
        let l = UILabel()
        l.text = text
        l.font = UIFont.systemFont(ofSize: 11, weight: .semibold)
        l.textColor = .secondaryLabel
        l.translatesAutoresizingMaskIntoConstraints = false
        return l
    }

    private func populateFields() {
        startPicker.date = entry.startTime ?? Date()

        let isRunning = entry.endTime == nil
        endPicker.isHidden    = isRunning
        runningLabel.isHidden = !isRunning
        if let end = entry.endTime { endPicker.date = end }

        notesView.text = entry.notes ?? ""
    }

    // MARK: - Actions

    @objc private func cancelTapped() {
        dismiss(animated: true)
    }

    @objc private func saveTapped() {
        let startDate = startPicker.date
        // If the entry is still running, keep endTime as nil
        let endDate = entry.endTime == nil ? nil : endPicker.date
        let notes   = notesView.text.trimmingCharacters(in: .whitespacesAndNewlines)

        DataManager.shared.updateEntry(entry, startTime: startDate, endTime: endDate, notes: notes.isEmpty ? nil : notes)
        dismiss(animated: true)
    }
}
