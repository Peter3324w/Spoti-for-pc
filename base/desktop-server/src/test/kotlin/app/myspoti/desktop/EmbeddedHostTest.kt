package app.myspoti.desktop

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class EmbeddedHostTest {
    @Test fun `evaluation waits for acknowledgement and propagates failure`() = runBlocking {
        val sent = mutableListOf<Map<String, Any?>>()
        val host = EmbeddedHost { sent.add(it) }
        val work = async(start = CoroutineStart.UNDISPATCHED) { host.evaluate("1 + 1") }
        assertFalse(work.isCompleted)
        assertEquals("host.evaluate", sent.single()["event"])
        assertEquals("1 + 1", sent.single()["script"])
        host.accept(gson.fromJson("""{"host":"result","id":1,"ok":true}""", com.google.gson.JsonObject::class.java))
        work.await()
        supervisorScope {
            val failed = async(start = CoroutineStart.UNDISPATCHED) { host.evaluate("throw Error()") }
            host.accept(gson.fromJson("""{"host":"result","id":2,"ok":false}""", com.google.gson.JsonObject::class.java))
            assertTrue(runCatching { failed.await() }.exceptionOrNull() is IllegalStateException)
        }
    }
    @Test fun `page messages reach the bridge while lifecycle messages stay separate`() = runBlocking {
        val host = EmbeddedHost { }
        val result = async(start = CoroutineStart.UNDISPATCHED) { host.messages.first() }
        host.accept(gson.fromJson("""{"host":"message","payload":"{\"type\":\"ready\"}"}""", com.google.gson.JsonObject::class.java))
        assertEquals("""{"type":"ready"}""", withTimeout(1000) { result.await() })
        host.accept(gson.fromJson("""{"host":"loaded"}""", com.google.gson.JsonObject::class.java))
        assertEquals("loaded", withTimeout(1000) { host.lifecycle.receive() })
    }
}
