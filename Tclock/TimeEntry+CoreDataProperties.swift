//
//  TimeEntry+CoreDataProperties.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import Foundation
import CoreData

extension TimeEntry {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<TimeEntry> {
        return NSFetchRequest<TimeEntry>(entityName: "TimeEntry")
    }

    @NSManaged public var id: UUID?
    @NSManaged public var startTime: Date?
    @NSManaged public var endTime: Date?
    @NSManaged public var notes: String?
    @NSManaged public var project: Project?
}

extension TimeEntry: Identifiable {}
