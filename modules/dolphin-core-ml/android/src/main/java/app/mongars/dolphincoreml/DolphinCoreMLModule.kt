package app.mongars.dolphincoreml

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DolphinCoreMLModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DolphinCoreML")

    AsyncFunction("initialize") { _: Map<String, Any?> ->
      mapOf(
        "success" to false,
        "error" to mapOf(
          "code" to "UNSUPPORTED_PLATFORM",
          "message" to "DolphinCoreML is only available on iOS devices."
        ),
        "metadata" to emptyMap<String, Any>(),
        "deviceInfo" to mapOf(
          "deviceModel" to "Android",
          "systemVersion" to android.os.Build.VERSION.RELEASE ?: "",
          "processorCount" to Runtime.getRuntime().availableProcessors(),
          "physicalMemory" to Runtime.getRuntime().maxMemory(),
          "thermalState" to 0,
          "isLowPowerModeEnabled" to false
        )
      )
    }

    AsyncFunction("generateStream") { _: String, _: Map<String, Any?>? ->
      throw UnsupportedOperationException("NO_MODEL_LOADED: DolphinCoreML is unavailable on Android")
    }

    AsyncFunction("encodeBatch") { _: List<String>, _: Map<String, Any?>? ->
      throw UnsupportedOperationException("NO_MODEL_LOADED: DolphinCoreML is unavailable on Android")
    }

    AsyncFunction("getMetrics") {
      mapOf(
        "encoding" to emptyMap<String, Any>(),
        "generation" to emptyMap<String, Any>(),
        "totalInferences" to 0,
        "lastOperationDuration" to 0,
        "lastOperationType" to "unsupported_platform"
      )
    }

    AsyncFunction("unloadModel") {
      true
    }
  }
}
