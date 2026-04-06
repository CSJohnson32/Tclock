//
//  SceneDelegate.swift
//  Tclock
//
//  Created by McKell Palmer on 1/22/20.
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let _ = (scene as? UIWindowScene) else { return }
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Notify TimeCardViewController to resume its display timer
        NotificationCenter.default.post(name: .appDidEnterForeground, object: nil)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Persist any unsaved Core Data changes
        DataManager.shared.saveContext()
    }
}
