//
//  ProjectTableViewCell.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class ProjectTableViewCell: UITableViewCell {

    // MARK: - Subviews

    private let colorSwatchView  = UIView()
    private let projectNameLabel = UILabel()
    private let totalTimeLabel   = UILabel()
    private let activeIndicator  = UIView()

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
        colorSwatchView.layer.cornerRadius = 6
        colorSwatchView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(colorSwatchView)

        projectNameLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        projectNameLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(projectNameLabel)

        totalTimeLabel.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        totalTimeLabel.textColor = .secondaryLabel
        totalTimeLabel.textAlignment = .right
        totalTimeLabel.setContentHuggingPriority(.required, for: .horizontal)
        totalTimeLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(totalTimeLabel)

        // Green pulsing dot shown when this project is the active one
        activeIndicator.backgroundColor = .systemGreen
        activeIndicator.layer.cornerRadius = 5
        activeIndicator.isHidden = true
        activeIndicator.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(activeIndicator)

        NSLayoutConstraint.activate([
            colorSwatchView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            colorSwatchView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            colorSwatchView.widthAnchor.constraint(equalToConstant: 28),
            colorSwatchView.heightAnchor.constraint(equalToConstant: 28),

            activeIndicator.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            activeIndicator.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            activeIndicator.widthAnchor.constraint(equalToConstant: 10),
            activeIndicator.heightAnchor.constraint(equalToConstant: 10),

            totalTimeLabel.trailingAnchor.constraint(equalTo: activeIndicator.leadingAnchor, constant: -10),
            totalTimeLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),

            projectNameLabel.leadingAnchor.constraint(equalTo: colorSwatchView.trailingAnchor, constant: 12),
            projectNameLabel.trailingAnchor.constraint(lessThanOrEqualTo: totalTimeLabel.leadingAnchor, constant: -8),
            projectNameLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 14),
            projectNameLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -14),
        ])
    }

    // MARK: - Configure

    func configure(with project: Project, totalTime: TimeInterval, isActive: Bool) {
        projectNameLabel.text = project.name ?? "Unnamed"
        totalTimeLabel.text   = totalTime > 0 ? totalTime.formattedAsSummary() : "0m"
        activeIndicator.isHidden = !isActive

        let fallbackColor = UIColor.systemBlue
        colorSwatchView.backgroundColor = project.colorHex.flatMap(UIColor.init(hex:)) ?? fallbackColor

        backgroundColor = isActive
            ? UIColor.systemGreen.withAlphaComponent(0.08)
            : .systemBackground
    }
}
