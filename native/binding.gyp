{
    "targets": [
        {
            "target_name": "NativeExtension",
            "sources": [ "NativeExtension.cpp", "VoyageCalculator.cpp", "ThreadPool.cpp", "VoyageCrewRanker.cpp" ],
            "include_dirs" : [
 	 			"<!(node -e \"require('nan')\")"
			]
        }
    ],
}