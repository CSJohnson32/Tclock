//
//  Project+CoreDataProperties.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import Foundation
import CoreData

extension Project {

    @nonobjc public class func fetchRequest() -> NSFetchRequest<Project> {
        return NSFetchRequest<Project>(entityName: "Project")
    }

    @NSManaged public var id: UUID?
    @NSManaged public var name: String?
    @NSManaged public var colorHex: String?
    @NSManaged public var createdAt: Date?
    @NSManaged public var entries: NSSet?
}

extension Project: Identifiable {}
