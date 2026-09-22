{
  "targets": [
    {
      "target_name": "spout",
      "sources": ["spout.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        ".\packages\Spout-SDK-binaries\Libs_2-007-017\include\SpoutGL",
        ".\packages\glfw-3.4.bin.WIN64\include"
      ],
      "libraries": [
        "..\\packages\\Spout-SDK-binaries\\Libs_2-007-017\\MD\\lib\\Spout.lib",
        "..\\packages\\glfw-3.4.bin.WIN64\\lib-vc2022\\glfw3.lib",
        "opengl32.lib"
      ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS"
      ],
      "copies": [
        {
          "destination": "<(PRODUCT_DIR)",
          "files": [
            ".\\packages\\glfw-3.4.bin.WIN64\\lib-vc2022\\glfw3.dll",
            ".\\packages\\Spout-SDK-binaries\\Libs_2-007-017\\MD\\bin\\Spout.dll"
          ]
        }
      ]
    }
  ]
}