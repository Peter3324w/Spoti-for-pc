package app.myspoti.desktop

import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.InputStream
import java.io.OutputStream
import java.io.PrintWriter

val gson = GsonBuilder().serializeNulls().create()
val commands = setOf("session.status", "account", "home", "search", "library", "liked", "playlist", "album", "artist", "player.play", "player.pause", "player.resume", "player.next", "player.previous", "player.seek", "player.shuffle", "player.repeat", "player.volume", "queue", "library.contains", "library.save")
data class Request(val id: Int, val method: String, val args: JsonObject)
fun parseRequest(line: String): Request {
    require(line.length <= 65536) { "Request too large" }
    val root = JsonParser.parseString(line).asJsonObject
    require(root.has("id") && root["id"].isJsonPrimitive && root["id"].asJsonPrimitive.isNumber) { "Missing request id" }
    val method = root["method"]?.asString
    require(method in commands) { "Unsupported command" }
    require(!root.has("args") || root["args"].isJsonObject) { "Arguments must be an object" }
    return Request(root["id"].asInt, method!!, root.getAsJsonObject("args") ?: JsonObject())
}
fun success(id: Int, value: Any?): String = gson.toJson(mapOf("id" to id, "ok" to true, "value" to value))

fun protocolReader(input: InputStream) = input.bufferedReader(Charsets.UTF_8)
fun protocolWriter(output: OutputStream) = PrintWriter(output.writer(Charsets.UTF_8), true)
