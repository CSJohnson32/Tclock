//
//  AppDelegate.swift
//  Tclock
//
//  Created by McKell Palmer on 1/22/20.
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Warm up the Core Data stack on launch
        _ = DataManager.shared

        // Seed default projects exactly once
        if !UserDefaults.standard.bool(forKey: "hasSeededProjects") {
            DataManager.shared.seedDefaultProjects()
            UserDefaults.standard.set(true, forKey: "hasSeededProjects")
        }

        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication,
                     didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {}
}
