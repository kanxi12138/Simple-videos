package com.simplevideos.app

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class UpdateFileProvider : FileProvider()

/** Only the trusted local UI can request updates from this fixed public repository. */
class UpdateManager(private val activity: Activity, private val emit: (JSONObject) -> Unit) {
    private data class Asset(val id: Long, val name: String, val size: Long, val url: String, val digest: String?)
    private data class Release(val id: Long, val tag: String, val version: String?, val assets: List<Asset>)
    private val handler = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val installed = activity.packageManager.getPackageInfo(activity.packageName, 0)
    private val directory = File(activity.cacheDir, "updates")
    private var state = JSONObject().put("status", "idle").put("message", "手动检查 GitHub 最新正式版本")
    private var release: Release? = null
    private var readyFile: File? = null
    private var readyAsset: Asset? = null
    private var generation = 0
    private var revision = 0
    private var installing = false
    @Volatile private var closed = false
    @Volatile private var connection: HttpURLConnection? = null

    companion object {
        private const val REPOSITORY = "https://api.github.com/repos/kanxi12138/Simple-videos"
        private const val MAX_APK_SIZE = 200L * 1024 * 1024
        private const val DOWNLOAD_TIMEOUT = 300000L
    }

    fun snapshot(): JSONObject = JSONObject(state.toString()).put("revision", revision)
        .put("currentVersion", installed.versionName).put("jobId", generation)

    private fun publish(status: String, message: String) {
        state.put("status", status).put("message", message)
        revision += 1
        emit(JSONObject().put("type", "update-state").put("state", snapshot()))
    }

    private fun busy(): Boolean = state.optString("status") in listOf("checking", "downloading") || installing

    fun check() {
        if (busy()) return
        val job = ++generation
        release = null
        readyFile = null
        readyAsset = null
        state = JSONObject()
        publish("checking", "正在检查…")
        worker.execute {
            val result = runCatching {
                val deadline = SystemClock.elapsedRealtime() + 30000
                val latest = json(REPOSITORY + "/releases/latest", deadline)
                if (latest.first == 404) {
                    val repository = json(REPOSITORY, deadline)
                    if (repository.first != 200 || repository.second.optBoolean("private", true)) {
                        throw IOException("仓库不可访问，请稍后重试")
                    }
                    null
                } else {
                    requireHttp(latest.first)
                    val data = latest.second
                    if (data.optBoolean("draft") || data.optBoolean("prerelease")) throw IOException("未取得正式 Release")
                    val tag = data.getString("tag_name")
                    val version = normalize(tag)
                    val assets = data.getJSONArray("assets")
                    val apks = (0 until assets.length()).map { assets.getJSONObject(it) }.filter {
                        it.optString("state") == "uploaded" && it.optString("name").endsWith(".apk", true)
                    }.map {
                        val url = it.getString("browser_download_url")
                        if (!downloadUrl(url) || Uri.parse(url).host != "github.com"
                            || !Uri.parse(url).path.orEmpty().startsWith("/kanxi12138/Simple-videos/releases/download/")) {
                            throw IOException("Release 附件地址不属于指定仓库")
                        }
                        val digest = it.optString("digest").takeIf { value -> value.isNotEmpty() && value != "null" }
                        if (digest != null && !Regex("sha256:[a-fA-F0-9]{64}").matches(digest)) throw IOException("附件校验值无法识别")
                        Asset(it.getLong("id"), it.getString("name"), it.getLong("size"), url, digest)
                    }
                    Release(data.getLong("id"), tag, version, apks)
                }
            }
            handler.post {
                if (closed || generation != job) return@post
                result.fold({ found ->
                    release = found
                    if (found == null) publish("no-release", "仓库尚未发布正式版本")
                    else {
                        state.put("releaseId", found.id).put("tagName", found.tag)
                            .put("latestVersion", found.version ?: JSONObject.NULL)
                            .put("assets", JSONArray().apply { found.assets.forEach { asset ->
                                put(JSONObject().put("id", asset.id).put("name", asset.name).put("size", asset.size))
                            } })
                        val current = normalize(installed.versionName.orEmpty())
                        if (found.version == null || current == null) publish("unknown-version", "最新标签 ${found.tag}，无法比较版本")
                        else {
                            val comparison = compare(found.version, current)
                            when {
                                comparison > 0 -> publish("available", "发现新版本 ${found.tag}" +
                                    if (found.assets.isEmpty()) "，该版本尚未上传安装包" else "")
                                comparison == 0 -> publish("latest", "当前已是最新版本")
                                else -> publish("ahead", "当前版本高于已发布版本 ${found.tag}")
                            }
                        }
                    }
                }, { failure -> publish("check-error", failureMessage(failure, "检查失败")) })
            }
        }
    }

    fun download(releaseId: Long, assetId: Long): String? {
        if (busy()) return "已有更新任务正在进行"
        val selectedRelease = release ?: return "请先检查更新"
        val current = normalize(installed.versionName.orEmpty())
        val version = selectedRelease.version
        if (selectedRelease.id != releaseId || current == null || version == null || compare(version, current) <= 0) return "更新信息已变化，请重新检查"
        val asset = selectedRelease.assets.find { it.id == assetId } ?: return "附件不存在，请重新检查"
        if (asset.size !in 1..MAX_APK_SIZE) return "安装包大小无效或超过 200 MiB"
        val job = ++generation
        readyFile = null
        readyAsset = null
        state.put("downloaded", 0).put("total", asset.size).put("assetId", asset.id)
        publish("downloading", "正在下载 ${asset.name}")
        val timeout = Runnable { if (!closed && generation == job) connection?.disconnect() }
        handler.postDelayed(timeout, DOWNLOAD_TIMEOUT)
        worker.execute {
            val partial = File(directory, "update.apk.part")
            val complete = File(directory, "update.apk")
            var result = runCatching {
                if (!directory.exists() && !directory.mkdirs()) throw IOException("无法创建更新缓存目录")
                if (complete.exists() && !complete.delete()) throw IOException("无法替换旧更新缓存")
                val deadline = SystemClock.elapsedRealtime() + DOWNLOAD_TIMEOUT
                val request = open(asset.url, deadline, true)
                try {
                    requireHttp(request.responseCode)
                    val digest = MessageDigest.getInstance("SHA-256")
                    var received = 0L
                    var lastProgress = 0L
                    request.inputStream.use { input -> partial.outputStream().use { output ->
                        val buffer = ByteArray(32768)
                        while (true) {
                            checkDeadline(deadline)
                            val count = input.read(buffer)
                            if (count == -1) break
                            received += count
                            if (received > asset.size || received > MAX_APK_SIZE) throw IOException("安装包大小与 Release 声明不一致")
                            output.write(buffer, 0, count)
                            digest.update(buffer, 0, count)
                            if (SystemClock.elapsedRealtime() - lastProgress >= 250) {
                                lastProgress = SystemClock.elapsedRealtime()
                                val bytes = received
                                handler.post { if (!closed && generation == job) {
                                    state.put("downloaded", bytes)
                                    publish("downloading", "正在下载 ${asset.name}")
                                } }
                            }
                        }
                    } }
                    if (received != asset.size) throw IOException("安装包下载不完整，请重试")
                    val hash = digest.digest().joinToString("") { "%02x".format(it) }
                    if (asset.digest != null && hash != asset.digest.substringAfter(':').lowercase()) throw IOException("安装包 SHA-256 校验失败")
                    validateApk(partial, version)
                    checkDeadline(deadline)
                    if (!partial.renameTo(complete)) throw IOException("无法保存安装包")
                    complete
                } finally { request.disconnect(); connection = null }
            }
            if (partial.exists() && !partial.delete()) result = Result.failure(IOException("下载失败，未完成缓存无法删除，请检查存储后重试"))
            handler.post {
                handler.removeCallbacks(timeout)
                if (closed || generation != job) return@post
                result.fold({ file ->
                    readyFile = file
                    readyAsset = asset
                    state.put("downloaded", asset.size)
                    publish("ready", "安装包已校验，可安装更新")
                }, { failure -> publish("download-error", failureMessage(failure, "下载失败")) })
            }
        }
        return null
    }

    fun install(callback: (String?, String?) -> Unit) {
        if (busy()) { callback(null, "已有更新任务正在进行"); return }
        val file = readyFile
        val version = release?.version
        if (file == null || version == null || readyAsset == null || !file.isFile) { callback(null, "请先下载并校验安装包"); return }
        installing = true
        worker.execute {
            val validation = runCatching { validateApk(file, version) }
            handler.post {
                installing = false
                if (closed) return@post
                validation.fold({
                    try {
                        if (!activity.packageManager.canRequestPackageInstalls()) {
                            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
                            callback("请允许简视频安装应用，返回后再次点击安装更新", null)
                        } else {
                            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", file)
                            activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                            callback("已打开系统安装界面，请确认安装", null)
                        }
                    } catch (failure: android.content.ActivityNotFoundException) {
                        callback(null, "设备没有可用的系统安装入口")
                    } catch (failure: SecurityException) {
                        callback(null, "系统拒绝安装请求，请检查安装权限")
                    }
                }, { failure -> callback(null, failureMessage(failure, "安装包校验失败")) })
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun validateApk(file: File, version: String) {
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val archive = activity.packageManager.getPackageArchiveInfo(file.absolutePath, flags) ?: throw IOException("无法读取 APK 安装信息")
        val current = activity.packageManager.getPackageInfo(activity.packageName, flags)
        if (archive.packageName != activity.packageName) throw IOException("APK 包名不匹配，已禁止安装")
        if (normalize(archive.versionName.orEmpty()) != version) throw IOException("APK 版本与 Release 标签不一致")
        val archiveCode = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        val currentCode = if (Build.VERSION.SDK_INT >= 28) current.longVersionCode else current.versionCode.toLong()
        if (archiveCode <= currentCode) throw IOException("APK 版本码不是更新版本，已禁止安装")
        fun certificates(info: PackageInfo): Set<String> {
            val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
            return signatures.orEmpty().map { signature ->
                MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { "%02x".format(it) }
            }.toSet()
        }
        val expected = certificates(current)
        if (expected.isEmpty() || certificates(archive) != expected) throw IOException("APK 签名与当前应用不一致，已禁止安装")
    }

    private fun normalize(tag: String): String? {
        val match = Regex("^[vV]?(\\d+)\\.(\\d+)\\.(\\d+)$").matchEntire(tag) ?: return null
        val parts = match.groupValues.drop(1).map { it.toIntOrNull() ?: return null }
        return parts.joinToString(".")
    }

    private fun compare(left: String, right: String): Int {
        val first = left.split('.').map(String::toInt)
        val second = right.split('.').map(String::toInt)
        for (index in first.indices) { val result = first[index].compareTo(second[index]); if (result != 0) return result }
        return 0
    }

    private fun checkDeadline(deadline: Long) {
        if (closed || Thread.currentThread().isInterrupted) throw IOException("更新任务已中断")
        if (SystemClock.elapsedRealtime() >= deadline) throw IOException("请求超时，请重试")
    }

    private fun downloadUrl(value: String): Boolean {
        val uri = Uri.parse(value)
        return uri.scheme == "https" && uri.userInfo == null && uri.port in listOf(-1, 443) && uri.fragment == null &&
            uri.host in listOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")
    }

    private fun open(value: String, deadline: Long, download: Boolean): HttpURLConnection {
        var address = value
        repeat(6) {
            checkDeadline(deadline)
            if (download) { if (!downloadUrl(address)) throw IOException("安装包重定向地址不受支持") }
            else if (!address.startsWith(REPOSITORY) || Uri.parse(address).host != "api.github.com") throw IOException("更新接口地址不受支持")
            val request = URL(address).openConnection() as HttpURLConnection
            connection = request
            val remaining = (deadline - SystemClock.elapsedRealtime()).coerceIn(1, Int.MAX_VALUE.toLong()).toInt()
            request.connectTimeout = minOf(10000, remaining)
            request.readTimeout = minOf(if (download) 30000 else 10000, remaining)
            request.instanceFollowRedirects = false
            request.setRequestProperty("User-Agent", "Simple-videos/${installed.versionName}")
            if (!download) {
                request.setRequestProperty("Accept", "application/vnd.github+json")
                request.setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
            }
            try {
                val status = request.responseCode
                if (status !in listOf(301, 302, 303, 307, 308)) return request
                address = URL(URL(address), request.getHeaderField("Location") ?: throw IOException("重定向地址缺失")).toString()
            } catch (failure: Exception) { request.disconnect(); connection = null; throw failure }
            request.disconnect()
            connection = null
        }
        throw IOException("更新请求重定向过多")
    }

    private fun json(url: String, deadline: Long): Pair<Int, JSONObject> {
        val request = open(url, deadline, false)
        try {
            val status = request.responseCode
            if (status == 404) return status to JSONObject()
            requireHttp(status)
            val output = java.io.ByteArrayOutputStream()
            request.inputStream.use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    checkDeadline(deadline)
                    val count = input.read(buffer)
                    if (count == -1) break
                    if (output.size() + count > 1048576) throw IOException("更新响应过大")
                    output.write(buffer, 0, count)
                }
            }
            return status to JSONObject(output.toString("UTF-8"))
        } finally { request.disconnect(); connection = null }
    }

    private fun requireHttp(status: Int) {
        if (status == 403 || status == 429) throw IOException("GitHub 限流或拒绝访问，请稍后重试")
        if (status != 200) throw IOException("GitHub 请求失败（HTTP $status）")
    }

    private fun failureMessage(failure: Throwable, fallback: String): String = when (failure) {
        is java.net.SocketTimeoutException -> "请求超时，请重试"
        is java.net.UnknownHostException, is java.net.ConnectException -> "无法连接 GitHub，请检查网络"
        is org.json.JSONException -> "GitHub 响应格式异常，请稍后重试"
        is IOException -> failure.message ?: fallback
        else -> fallback
    }

    fun close() {
        closed = true
        connection?.disconnect()
        handler.removeCallbacksAndMessages(null)
        worker.shutdownNow()
    }
}
