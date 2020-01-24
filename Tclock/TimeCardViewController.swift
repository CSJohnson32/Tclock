//
//  FirstViewController.swift
//  Tclock
//
//  Created by McKell Palmer on 1/22/20.
//  Copyright © 2020 Carter Johnson. All rights reserved.
//

import UIKit

class TimeCardViewController: UIViewController {

    
    
    //Mark: Properties
    @IBOutlet weak var dig_clock: UILabel!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view.
        let dateFormatter = DateFormatter()
        let date = Date(timeIntervalSinceReferenceDate: 410220000)
         
        // US English Locale (en_US)
        dateFormatter.locale = Locale(identifier: "en_US")
        dateFormatter.setLocalizedDateFormatFromTemplate("MMMMd") // set template after setting locale
        print(dateFormatter.string(from: date))
    
        
    }
    
    
    
    
    @IBAction func hello_world(sender: UIButton) {
           
           print("Hello, World!")
       }


}

