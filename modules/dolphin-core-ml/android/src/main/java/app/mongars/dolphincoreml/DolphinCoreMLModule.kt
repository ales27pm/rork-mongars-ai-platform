package app.mongars.dolphincoreml

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DolphinCoreMLModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DolphinCoreML")

    AsyncFunction("initialize") {
      val result = mutableMapOf<String, Any?>()
      result["success"] = false
      result["error"] = mapOf(
        "code" to "UNSUPPORTED_PLATFORM",
        "message" to "DolphinCoreML is only available on iOS devices."
      )
      result["metadata"] = emptyMap<String, Any>()

      val deviceInfo = mutableMapOf<String, Any?>()
      deviceInfo["deviceModel"] = "Android"
      deviceInfo["systemVersion"] = android.os.Build.VERSION.RELEASE ?: ""
      deviceInfo["processorCount"] = Runtime.getRuntime().availableProcessors()
      deviceInfo["physicalMemory"] = Runtime.getRuntime().maxMemory()
      deviceInfo["thermalState"] = 0
      deviceInfo["isLowPowerModeEnabled"] = false

      result["deviceInfo"] = deviceInfo
      result
    }

    AsyncFunction("generateStream") { _: String, _: Map<String, Any?>? ->
      throw UnsupportedOperationException("NO_MODEL_LOADED: DolphinCoreML is unavailable on Android")
      Unit
    }

    AsyncFunction("encodeBatch") { _: List<String>, _: Map<String, Any?>? ->
      throw UnsupportedOperationException("NO_MODEL_LOADED: DolphinCoreML is unavailable on Android")
      Unit
    }

    AsyncFunction("getMetrics") {
      mapOf(
        "encoding" to emptyMap<String, Any>(),
        "generation" to emptyMap<String, Any>(),
        "totalInferences" to 0,
        "lastOperationDuration" to 0,
        "lastOperationType" to ""
      )
    }

    AsyncFunction("unloadModel") {
      true
    }
  }
}
