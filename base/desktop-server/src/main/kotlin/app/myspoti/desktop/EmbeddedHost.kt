package app.myspoti.desktop

import app.myspoti.spotify.bridge.BridgeHost
import com.google.gson.JsonObject
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/** Private stdin/stdout transport to the sandboxed Electron playback view. */
class EmbeddedHost(private val emit: (Map<String, Any?>) -> Unit) : BridgeHost {
    override val messages = MutableSharedFlow<String>(extraBufferCapacity = 256)
    val lifecycle = Channel<String>(Channel.CONFLATED)
    private val sequence = AtomicInteger()
    private val pending = ConcurrentHashMap<Int, CompletableDeferred<Unit>>()

    override suspend fun evaluate(script: String) {
        val id = sequence.incrementAndGet()
        val reply = CompletableDeferred<Unit>()
        pending[id] = reply
        try {
            emit(mapOf("event" to "host.evaluate", "id" to id, "script" to script))
            withTimeout(30_000) { reply.await() }
        } finally { pending.remove(id) }
    }

    fun accept(message: JsonObject) {
        when (val kind = message["host"]?.asString) {
            "message" -> messages.tryEmit(message["payload"].asString)
            "result" -> pending.remove(message["id"].asInt)?.let {
                if (message["ok"]?.asBoolean == true) it.complete(Unit)
                else it.completeExceptionally(IllegalStateException("Playback page is not ready"))
            }
            "starting", "loaded" -> lifecycle.trySend(kind)
            else -> throw IllegalArgumentException("Unknown host message")
        }
    }
}
