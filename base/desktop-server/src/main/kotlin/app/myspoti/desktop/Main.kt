package app.myspoti.desktop

import app.myspoti.api.*
import app.myspoti.host.cdp.CdpHost
import app.myspoti.spotify.SpotifyApi
import com.google.gson.JsonObject
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import java.io.FileDescriptor
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

fun main(args: Array<String>) = runBlocking {
    val output = protocolWriter(FileOutputStream(FileDescriptor.out))
    val input = protocolReader(System.`in`)
    System.setOut(java.io.PrintStream(System.err)) // Upstream diagnostics must not corrupt the RPC stream.
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    fun emit(value: Any) { synchronized(output) { output.println(gson.toJson(value)) } }
    val host = AtomicReference<CdpHost?>(null)
    val api = AtomicReference<SpotifyApi?>(null)
    val signedIn = AtomicBoolean(false)
    val sessionError = AtomicReference<String?>(null)
    fun session() = mapOf("connected" to (api.get()?.ready?.value == true), "signedIn" to signedIn.get(), "error" to sessionError.get())
    val boot = scope.launch {
        try {
            val endpoint = args.firstOrNull() ?: error("Missing Chrome endpoint")
            require(Regex("http://127\\.0\\.0\\.1:[0-9]+").matches(endpoint)) { "Invalid Chrome endpoint" }
            val connectedHost = CdpHost.connect(endpoint)
            host.set(connectedHost)
            val service = SpotifyApi(connectedHost, scope, deviceId = args.getOrNull(1)?.also { java.util.UUID.fromString(it) })
            api.set(service)
            launch { while (isActive) { connectedHost.awaitLoad(); service.onPageStarting(); runCatching { service.onPageLoaded() } } }
            launch { service.player.state.collectLatest { emit(mapOf("event" to "player", "value" to it)) } }
            while (isActive) {
                try {
                    if (!service.ready.value) withTimeout(5000) { service.onPageLoaded() }
                    signedIn.set(service.ready.value && withTimeout(5000) { service.isSignedIn() })
                    sessionError.set(null)
                } catch (_: Exception) { signedIn.set(false) }
                emit(mapOf("event" to "session", "value" to session()))
                delay(2000)
            }
        } catch (e: Exception) {
            sessionError.set("Could not connect to Chrome. Close the playback window and reconnect.")
            emit(mapOf("event" to "session", "value" to session()))
        }
    }
    try {
        while (true) {
            val line = withContext(Dispatchers.IO) { input.readLine() } ?: break
            scope.launch {
                var id = -1
                try {
                    val request = parseRequest(line); id = request.id
                    val value = if (request.method == "session.status") session() else {
                        check(signedIn.get()) { "Sign in to Spotify in the playback window first." }
                        withTimeout(35000) { dispatch(api.get() ?: error("Player is starting"), request) }
                    }
                    synchronized(output) { output.println(success(id, value)) }
                } catch (e: Exception) {
                    // Service failures can contain request headers/tokens. Only expose known validation text.
                    val message = when (e) {
                        is IllegalArgumentException -> "Invalid request or unsupported command."
                        is IllegalStateException -> if (e.message == "Sign in to Spotify in the playback window first.") e.message!! else "Spotify could not complete this request. Try again."
                        is TimeoutCancellationException -> "Spotify took too long to respond. Try again."
                        else -> "Spotify could not complete this request. Try again."
                    }
                    emit(mapOf("id" to id, "ok" to false, "error" to message))
                }
            }
        }
    } finally {
        boot.cancel(); scope.cancel(); host.get()?.close()
    }
}

private fun JsonObject.text(key: String): String = get(key)?.asString?.takeIf { it.isNotBlank() && it.length < 2048 } ?: throw IllegalArgumentException("Missing $key")
private fun JsonObject.offset(): Int = (get("offset")?.asInt ?: 0).also { require(it >= 0) }
private fun JsonObject.uri(): String = text("uri").also { require(it.startsWith("spotify:")) }

suspend fun dispatch(api: MyspotiApi, request: Request): Any? {
    val a = request.args
    return when (request.method) {
        "account" -> api.users.me()
        "home" -> api.home.feed(HomeFilter.valueOf(a.get("filter")?.asString ?: "ALL"))
        "search" -> api.search.all(a.text("query"), limit = 20)
        "library" -> api.library.items(filter = LibraryFilter.valueOf(a.get("filter")?.asString ?: "ALL"), offset = a.offset())
        "liked" -> api.library.likedTracks(offset = a.offset())
        "playlist" -> mapOf("details" to api.playlists.playlist(a.uri()), "tracks" to api.playlists.tracks(a.uri(), offset = a.offset(), limit = 50))
        "album" -> mapOf("details" to api.catalog.album(a.uri()), "tracks" to api.catalog.albumTracks(a.uri(), offset = a.offset()))
        "artist" -> api.catalog.artistPage(a.uri())
        "player.play" -> api.player.play(a.uri(), trackUri = a.get("trackUri")?.asString)
        "player.pause" -> api.player.pause()
        "player.resume" -> api.player.resume()
        "player.next" -> api.player.next()
        "player.previous" -> api.player.previous()
        "player.seek" -> api.player.seek(a.get("positionMs").asLong.also { require(it >= 0) })
        "player.shuffle" -> api.player.setShuffle(a.get("on").asBoolean)
        "player.repeat" -> api.player.setRepeat(Repeat.valueOf(a.text("mode")))
        "player.volume" -> if (a.has("level")) api.player.setVolume(a.get("level").asDouble.also { require(it.isFinite() && it in 0.0..1.0) }) else api.player.volume()
        "queue" -> api.player.queue.value
        "library.contains" -> api.library.contains(listOf(a.uri())).firstOrNull() ?: false
        "library.save" -> if (a.get("saved").asBoolean) api.library.add(listOf(a.uri())) else api.library.remove(listOf(a.uri()))
        else -> throw IllegalArgumentException("Unsupported command")
    }.let { if (it is Unit) null else it }
}
