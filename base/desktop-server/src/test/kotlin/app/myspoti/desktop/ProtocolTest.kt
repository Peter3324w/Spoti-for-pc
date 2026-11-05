package app.myspoti.desktop

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ProtocolTest {
    @Test fun `unknown commands and malformed requests are rejected`() {
        assertThrows(IllegalArgumentException::class.java) { parseRequest("""{"id":1,"method":"raw.request"}""") }
        assertThrows(IllegalArgumentException::class.java) { parseRequest("""{"method":"session.status"}""") }
        assertThrows(IllegalArgumentException::class.java) { parseRequest("""{"id":1,"method":"player.seek","args":[]}""") }
    }
    @Test fun `the desktop pipe uses UTF8 regardless of Windows default encoding`() {
        val line = """{"id":7,"method":"search","args":{"query":"Björk 東京"}}"""
        val input = java.io.ByteArrayInputStream((line + "\n").toByteArray(Charsets.UTF_8))
        assertEquals("Björk 東京", parseRequest(protocolReader(input).readLine()).args.get("query").asString)
        val bytes = java.io.ByteArrayOutputStream()
        protocolWriter(bytes).println(success(7, "Björk 東京"))
        assertTrue(bytes.toString("UTF-8").contains("Björk 東京"))
    }
    @Test fun `empty results retain an explicit JSON null`() {
        val reply = gson.fromJson(success(3, null), com.google.gson.JsonObject::class.java)
        assertTrue(reply.has("value"))
        assertTrue(reply.get("value").isJsonNull)
    }
    @Test fun `results preserve IDs and JSON data`() {
        val request = parseRequest("""{"id":12,"method":"search","args":{"query":"Björk"}}""")
        assertEquals(12, request.id)
        assertEquals("Björk", request.args.get("query").asString)
        val reply = gson.fromJson(success(request.id, mapOf("name" to "Björk")), com.google.gson.JsonObject::class.java)
        assertTrue(reply.get("ok").asBoolean)
        assertEquals(12, reply.get("id").asInt)
        assertEquals("Björk", reply.getAsJsonObject("value").get("name").asString)
    }
}
