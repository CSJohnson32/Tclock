//
//  DataManager.swift
//  Tclock
//
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import CoreData
import UIKit

class DataManager {

    static let shared = DataManager()
    private init() {}

    // MARK: - Core Data Stack

    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "Tclock")
        let description = container.persistentStoreDescriptions.first
        description?.shouldMigrateStoreAutomatically = true
        description?.shouldInferMappingModelAutomatically = true
        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Core Data store failed to load: \(error)")
            }
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        return container
    }()

    var context: NSManagedObjectContext {
        return persistentContainer.viewContext
    }

    func saveContext() {
        guard context.hasChanges else { return }
        do {
            try context.save()
        } catch {
            print("Core Data save error: \(error)")
        }
    }

    // MARK: - Projects

    func fetchAllProjects() -> [Project] {
        let request: NSFetchRequest<Project> = Project.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(keyPath: \Project.createdAt, ascending: true)]
        return (try? context.fetch(request)) ?? []
    }

    @discardableResult
    func createProject(name: String, colorHex: String = "#007AFF") -> Project {
        let project = Project(context: context)
        project.id = UUID()
        project.name = name
        project.colorHex = colorHex
        project.createdAt = Date()
        saveContext()
        NotificationCenter.default.post(name: .didUpdateProjects, object: nil)
        return project
    }

    func deleteProject(_ project: Project) {
        context.delete(project)
        saveContext()
        NotificationCenter.default.post(name: .didUpdateProjects, object: nil)
    }

    func seedDefaultProjects() {
        let defaults: [(String, String)] = [
            ("General", "#007AFF"),
            ("Development", "#34C759"),
            ("Design", "#FF9500"),
            ("Meetings", "#FF3B30"),
            ("Research", "#5856D6"),
        ]
        for (name, color) in defaults {
            createProject(name: name, colorHex: color)
        }
    }

    // MARK: - Time Entries

    func fetchActiveEntry() -> TimeEntry? {
        let request: NSFetchRequest<TimeEntry> = TimeEntry.fetchRequest()
        request.predicate = NSPredicate(format: "endTime == nil")
        request.fetchLimit = 1
        return (try? context.fetch(request))?.first
    }

    func fetchAllEntries() -> [TimeEntry] {
        let request: NSFetchRequest<TimeEntry> = TimeEntry.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(keyPath: \TimeEntry.startTime, ascending: false)]
        return (try? context.fetch(request)) ?? []
    }

    func fetchEntries(for project: Project, from startDate: Date, to endDate: Date) -> [TimeEntry] {
        let request: NSFetchRequest<TimeEntry> = TimeEntry.fetchRequest()
        request.predicate = NSPredicate(
            format: "project == %@ AND startTime >= %@ AND startTime <= %@",
            project, startDate as NSDate, endDate as NSDate
        )
        request.sortDescriptors = [NSSortDescriptor(keyPath: \TimeEntry.startTime, ascending: false)]
        return (try? context.fetch(request)) ?? []
    }

    @discardableResult
    func createEntry(project: Project, startTime: Date = Date()) -> TimeEntry {
        let entry = TimeEntry(context: context)
        entry.id = UUID()
        entry.startTime = startTime
        entry.project = project
        saveContext()
        NotificationCenter.default.post(name: .didUpdateTimeEntries, object: nil)
        return entry
    }

    @discardableResult
    func stopActiveEntry() -> TimeEntry? {
        guard let entry = fetchActiveEntry() else { return nil }
        entry.endTime = Date()
        saveContext()
        NotificationCenter.default.post(name: .didUpdateTimeEntries, object: nil)
        return entry
    }

    func updateEntry(_ entry: TimeEntry, startTime: Date, endTime: Date?, notes: String?) {
        entry.startTime = startTime
        entry.endTime = endTime
        entry.notes = notes
        saveContext()
        NotificationCenter.default.post(name: .didUpdateTimeEntries, object: nil)
    }

    func deleteEntry(_ entry: TimeEntry) {
        context.delete(entry)
        saveContext()
        NotificationCenter.default.post(name: .didUpdateTimeEntries, object: nil)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let didUpdateTimeEntries  = Notification.Name("didUpdateTimeEntries")
    static let didUpdateProjects     = Notification.Name("didUpdateProjects")
    static let appDidEnterForeground = Notification.Name("appDidEnterForeground")
}
