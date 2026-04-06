//
//  Utilities.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

// MARK: - TimeInterval Formatting

extension TimeInterval {
    /// Returns "HH:MM:SS" — used for the live elapsed clock display.
    func formattedAsElapsed() -> String {
        let total = Int(max(self, 0))
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    /// Returns "Xh Ym" — used for summary totals.
    func formattedAsSummary() -> String {
        let total = Int(max(self, 0))
        let h = total / 3600
        let m = (total % 3600) / 60
        if h > 0 {
            return "\(h)h \(m)m"
        } else {
            return "\(m)m"
        }
    }
}

// MARK: - UIColor Hex Support

extension UIColor {
    convenience init?(hex: String) {
        var normalized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.hasPrefix("#") { normalized = String(normalized.dropFirst()) }
        guard normalized.count == 6, let value = UInt64(normalized, radix: 16) else { return nil }
        let r = CGFloat((value >> 16) & 0xFF) / 255.0
        let g = CGFloat((value >>  8) & 0xFF) / 255.0
        let b = CGFloat( value        & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
