//
//  TimeEntryTableViewCell.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class TimeEntryTableViewCell: UITableViewCell {

    // MARK: - Subviews

    private let colorSwatchView  = UIView()
    private let projectNameLabel = UILabel()
    private let dateRangeLabel   = UILabel()
    private let durationLabel    = UILabel()
    private let runningLabel     = UILabel()

    // MARK: - Init

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    // MARK: - Setup

    private func setupUI() {
        colorSwatchView.layer.cornerRadius = 5
        colorSwatchView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(colorSwatchView)

        projectNameLabel.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        projectNameLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(projectNameLabel)

        dateRangeLabel.font = UIFont.systemFont(ofSize: 13, weight: .regular)
        dateRangeLabel.textColor = .secondaryLabel
        dateRangeLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(dateRangeLabel)

        runningLabel.text = "● Running"
        runningLabel.font = UIFont.systemFont(ofSize: 12, weight: .medium)
        runningLabel.textColor = .systemGreen
        runningLabel.isHidden = true
        runningLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(runningLabel)

        durationLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 14, weight: .medium)
        durationLabel.textColor = .label
        durationLabel.textAlignment = .right
        durationLabel.setContentHuggingPriority(.required, for: .horizontal)
        durationLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(durationLabel)

        NSLayoutConstraint.activate([
            colorSwatchView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            colorSwatchView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 14),
            colorSwatchView.widthAnchor.constraint(equalToConstant: 12),
            colorSwatchView.heightAnchor.constraint(equalToConstant: 12),

            durationLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            durationLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            durationLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 55),

            projectNameLabel.leadingAnchor.constraint(equalTo: colorSwatchView.trailingAnchor, constant: 10),
            projectNameLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 10),
            projectNameLabel.trailingAnchor.constraint(lessThanOrEqualTo: durationLabel.leadingAnchor, constant: -8),

            dateRangeLabel.leadingAnchor.constraint(equalTo: projectNameLabel.leadingAnchor),
            dateRangeLabel.topAnchor.constraint(equalTo: projectNameLabel.bottomAnchor, constant: 2),
            dateRangeLabel.trailingAnchor.constraint(lessThanOrEqualTo: durationLabel.leadingAnchor, constant: -8),

            runningLabel.leadingAnchor.constraint(equalTo: projectNameLabel.leadingAnchor),
            runningLabel.topAnchor.constraint(equalTo: dateRangeLabel.bottomAnchor, constant: 2),
            runningLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -10),
        ])

        // When runningLabel is hidden, constrain dateRange bottom to contentView
        let dateRangeBottom = dateRangeLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -10)
        dateRangeBottom.priority = .defaultLow
        dateRangeBottom.isActive = true
    }

    // MARK: - Configure

    func configure(with entry: TimeEntry) {
        projectNameLabel.text = entry.project?.name ?? "Unknown Project"

        let colorHex = entry.project?.colorHex ?? "#007AFF"
        colorSwatchView.backgroundColor = UIColor(hex: colorHex) ?? .systemBlue

        let isRunning = entry.endTime == nil
        runningLabel.isHidden = !isRunning

        let timeFmt = DateFormatter()
        timeFmt.dateFormat = "h:mm a"
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "MMM d"

        if let start = entry.startTime {
            let datePart = dateFmt.string(from: start)
            let startPart = timeFmt.string(from: start)
            if isRunning {
                dateRangeLabel.text = "\(datePart) · \(startPart) – now"
            } else if let end = entry.endTime {
                dateRangeLabel.text = "\(datePart) · \(startPart) – \(timeFmt.string(from: end))"
            }
            let elapsed = (entry.endTime ?? Date()).timeIntervalSince(start)
            durationLabel.text = elapsed.formattedAsSummary()
        } else {
            dateRangeLabel.text = "—"
            durationLabel.text  = "0m"
        }
    }
}
