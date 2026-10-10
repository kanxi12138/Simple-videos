package com.simplevideos.app

import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.View
import android.view.MotionEvent
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var root: FrameLayout
    private lateinit var shell: WebView
    private lateinit var updates: UpdateManager
    private val handler = Handler(Looper.getMainLooper())
    private val platforms = mutableMapOf<String, JSONObject>()
    private val pendingRequests = mutableListOf<JSONObject>()
    private val scrapers = mutableSetOf<WebView>()
    private val listCache = mutableMapOf<String, Pair<JSONObject, Int>>()
    private class ListTask(val key: String, val cacheKey: String, val platform: JSONObject,
        val url: String, val page: Int, val batch: Int?, val revision: Int, val requests: MutableList<Int>) {
        var cancel: (() -> Unit)? = null
    }
    private val listTasks = mutableMapOf<String, ListTask>()
    private val listQueue = ArrayDeque<ListTask>()
    private val listRevisions = mutableMapOf<String, Int>()
    private var runningLists = 0
    private var nextListRevision = 0
    private var searchBatch = 0
    private var searchQuery = ""
    private data class AuthConfirmation(val checkedAt: Long, val fingerprint: String)
    private val authCache = mutableMapOf<String, AuthConfirmation>()
    private val cookieWriter = Executors.newSingleThreadExecutor()
    private var cookieFlushRunning = false
    private var cookieFlushAgain = false
    private val cookieFlushWaiters = mutableListOf<(String?) -> Unit>()
    private var browserGeneration = 0
    private var remote: WebView? = null
    private var remotePlatform: JSONObject? = null
    private var pendingVideo: JSONObject? = null
    private var remoteMode = ""
    private var verificationQuery = ""
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    private var extractor = ""
    private var destroyed = false
    private var darkTheme = false
    private var playerScript = ""
    private var playerSession = 0
    private var unifiedPlayer = false
    private var playerFullscreen = false
    private var previousOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    private var foreground = true
    private var playerPolling = false
    private var playerPollGeneration = 0
    private val playerPoll = Runnable { pollPlayer() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (android.os.Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false)
        else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        root = FrameLayout(this)
        setContentView(root)
        root.setOnApplyWindowInsetsListener { _, insets ->
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                val system = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                val keyboard = insets.getInsets(WindowInsets.Type.ime())
                root.setPadding(system.left, system.top, system.right, maxOf(system.bottom, keyboard.bottom))
                // The WebViews are already inside the safe area; do not apply these insets twice.
                WindowInsets.CONSUMED
            } else {
                @Suppress("DEPRECATION")
                root.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
                @Suppress("DEPRECATION")
                val consumed = insets.consumeSystemWindowInsets().consumeStableInsets()
                if (android.os.Build.VERSION.SDK_INT >= 28) consumed.consumeDisplayCutout() else consumed
            }
        }
        extractor = assets.open("shared/extract.js").bufferedReader().use { it.readText() }
        playerScript = assets.open("shared/player.js").bufferedReader().use { it.readText() }
        shell = object : WebView(this) {
            override fun dispatchTouchEvent(event: MotionEvent): Boolean {
                // Fullscreen touches belong to the official WebView below the transparent shell.
                if (playerFullscreen) return false
                return super.dispatchTouchEvent(event)
            }
        }
        shell.settings.javaScriptEnabled = true
        shell.settings.domStorageEnabled = true
        shell.settings.allowFileAccess = false
        shell.settings.allowContentAccess = false
        shell.setBackgroundColor(Color.rgb(245, 248, 252))
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        shell.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (request.url.host == "appassets.androidplatform.net") {
                    return loader.shouldInterceptRequest(request.url)
                        ?: WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
                }
                // CSP allows HTTPS cover images only; external top-level navigation stays blocked.
                return if (!request.isForMainFrame && request.url.scheme == "https") null
                    else WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = true
            override fun onPageFinished(view: WebView, url: String) {
                if (platforms.isNotEmpty()) return
                view.evaluateJavascript("JSON.stringify(SimplePlatforms.platforms)") { value ->
                    val decoded = JSONTokener(value).nextValue() as? String ?: return@evaluateJavascript
                    val config = JSONArray(decoded)
                    for (index in 0 until config.length()) {
                        val platform = config.getJSONObject(index)
                        platforms[platform.getString("id")] = platform
                    }
                    pendingRequests.toList().forEach(::dispatch)
                    pendingRequests.clear()
                }
            }
        }
        shell.addJavascriptInterface(LocalBridge(), "AndroidBridge")
        updates = UpdateManager(this, ::emit)
        root.addView(shell, FrameLayout.LayoutParams(-1, -1))
        applySystemTheme(false)
        root.requestApplyInsets()
        shell.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) { handleBack() }
        }
    }

    private inner class LocalBridge {
        @JavascriptInterface
        fun request(serialized: String) {
            if (serialized.length > 16000) return
            val request = try { JSONObject(serialized) } catch (_: org.json.JSONException) { return }
            handler.post {
                if (destroyed) return@post
                if (platforms.isEmpty()) pendingRequests.add(request) else dispatch(request)
            }
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (::shell.isInitialized && !destroyed) {
            emit(JSONObject().put("type", "system-theme").put("dark", systemIsDark()))
        }
    }

    private fun systemIsDark(): Boolean =
        resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

    @Suppress("DEPRECATION")
    private fun applySystemTheme(dark: Boolean) {
        darkTheme = dark
        val surface = if (dark) Color.rgb(23, 38, 60) else Color.WHITE
        val background = if (dark) Color.rgb(16, 26, 42) else Color.rgb(245, 248, 252)
        root.setBackgroundColor(if (playerFullscreen) Color.BLACK else surface)
        shell.setBackgroundColor(if (playerFullscreen) Color.TRANSPARENT else background)
        window.decorView.setBackgroundColor(if (playerFullscreen) Color.BLACK else surface)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (android.os.Build.VERSION.SDK_INT >= 29) window.isNavigationBarContrastEnforced = false
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (dark) 0 else mask, mask)
        } else {
            val mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            val flags = window.decorView.systemUiVisibility and mask.inv()
            window.decorView.systemUiVisibility = flags or if (dark) 0 else mask
        }
    }

    private fun respond(id: Int, result: JSONObject = JSONObject(), error: String? = null) {
        if (destroyed) return
        val response = if (error != null) JSONObject().put("error", error) else JSONObject().put("result", result)
        shell.evaluateJavascript("window.nativeResponse($id,$response)", null)
    }

    private fun emit(event: JSONObject) {
        if (!destroyed) shell.evaluateJavascript("window.nativeEvent($event)", null)
    }

    private fun allowed(platform: JSONObject, url: String): Boolean {
        val parsed = Uri.parse(url)
        if (parsed.scheme != "https" || parsed.userInfo != null) return false
        val host = parsed.host?.lowercase() ?: return false
        val domains = platform.getJSONArray("domains")
        return (0 until domains.length()).any { index ->
            val domain = domains.getString(index)
            host == domain || host.endsWith(".$domain")
        }
    }

    private fun snapshot(view: WebView, platform: JSONObject, authOnly: Boolean = false, complete: (JSONObject) -> Unit) {
        if (destroyed) return
        val operation = if (authOnly) "extractAuthPage" else "extractPage"
        view.evaluateJavascript("$extractor\nJSON.stringify(SimpleExtractor.$operation($platform))") { encoded ->
            if (destroyed) return@evaluateJavascript
            try {
                val decoded = JSONTokener(encoded).nextValue() as? String
                complete(if (decoded != null) JSONObject(decoded) else JSONObject())
            } catch (_: org.json.JSONException) { complete(JSONObject()) }
        }
    }

    private fun officialView(platform: JSONObject, visible: Boolean): WebView {
        val view = WebView(this)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Playback is requested from the trusted local controls in another WebView.
            mediaPlaybackRequiresUserGesture = !(visible && remoteMode == "play")
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = visible
            displayZoomControls = false
            setSupportMultipleWindows(true)
            val version = Regex("Chrome/([0-9.]+)").find(userAgentString)?.groupValues?.get(1) ?: "150.0.0.0"
            userAgentString = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$version Safari/537.36"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        if (visible) view.setInitialScale((resources.displayMetrics.widthPixels / resources.displayMetrics.density / 1280 * 100).toInt())
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(webView: WebView, request: WebResourceRequest): Boolean {
                val blocked = !allowed(platform, request.url.toString())
                if (blocked && visible) emit(JSONObject().put("type", "notice")
                    .put("message", "该链接需要官方客户端或其他网站，已保留当前页面"))
                return blocked
            }
            override fun onPageStarted(webView: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (visible) emit(JSONObject().put("type", "browser-loading").put("loading", true))
                if (visible && remoteMode == "play") {
                    playerSession += 1
                    stopPlayerPoll()
                    emit(JSONObject().put("type", "player-reset").put("session", playerSession))
                }
            }
            override fun onPageFinished(webView: WebView, url: String) {
                flushCookies()
                if (visible) emit(JSONObject().put("type", "browser-loading").put("loading", false))
                if (visible && remoteMode == "play" && unifiedPlayer) startPlayerPoll()
                if (visible && webView === remote) {
                    snapshot(webView, platform, true) { page ->
                        if (webView !== remote) return@snapshot
                        val auth = authState(platform, page)
                        if (auth == "authenticated") rememberAuth(platform, auth)
                        else if (auth == "anonymous" && page.optBoolean("ready") && !page.optBoolean("challenged")) {
                            handler.postDelayed({
                                if (!destroyed && webView === remote) snapshot(webView, platform, true) { confirmed ->
                                    if (webView === remote && confirmed.optBoolean("ready") && !confirmed.optBoolean("challenged")
                                        && authState(platform, confirmed) == "anonymous") rememberAuth(platform, "anonymous")
                                }
                            }, 500)
                        }
                    }
                }
                if (visible && webView === remote && remoteMode == "login") {
                    webView.evaluateJavascript("""$extractor
                    (() => {
                        if (SimpleExtractor.extractAuthPage($platform).auth === 'authenticated') return;
                        const node = [...document.querySelectorAll('a,button,[role="button"],span,div')]
                          .find(element => element.getClientRects().length && /^(登录|立即登录|请登录|登录注册|登录\/注册)$/.test(element.textContent.trim()));
                        const fallback = ${JSONObject.quote(platform.optString("loginTrigger"))};
                        if(node) node.click();
                        else if(fallback) document.querySelector(fallback)?.click();
                    })()""".trimIndent(), null)
                }
            }
            override fun onReceivedError(webView: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (visible && request.isForMainFrame) emit(JSONObject().put("type", "notice")
                    .put("message", "官网加载失败：${error.description}"))
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (allowed(platform, request.origin.toString()) && request.resources.all { it == PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID }) {
                    request.grant(request.resources)
                } else request.deny()
            }
            override fun onShowCustomView(customView: View, callback: CustomViewCallback) {
                if (!visible || fullscreenView != null) { callback.onCustomViewHidden(); return }
                fullscreenView = customView
                fullscreenCallback = callback
                shell.visibility = View.INVISIBLE
                remote?.visibility = View.INVISIBLE
                root.addView(customView, FrameLayout.LayoutParams(-1, -1))
                setPlayerFullscreen(true)
            }
            override fun onHideCustomView() {
                if (fullscreenView != null) {
                    removeFullscreenView(false)
                    setPlayerFullscreen(false)
                }
            }
            override fun onCreateWindow(webView: WebView, isDialog: Boolean, isUserGesture: Boolean, message: android.os.Message): Boolean {
                if (!visible || !isUserGesture) return false
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(popupView: WebView, request: WebResourceRequest): Boolean {
                        if (allowed(platform, request.url.toString())) webView.loadUrl(request.url.toString())
                        handler.post { popup.destroy() }
                        return true
                    }
                }
                (message.obj as WebView.WebViewTransport).webView = popup
                message.sendToTarget()
                handler.postDelayed({ popup.destroy() }, 15000)
                return true
            }
        }
        return view
    }

    private fun readPage(platform: JSONObject, url: String, detailMode: Boolean = false,
        authMode: Boolean = false, complete: (JSONObject) -> Unit): () -> Unit {
        val view = officialView(platform, false)
        view.alpha = 0f
        view.isClickable = false
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        scrapers.add(view)
        // A real desktop viewport is needed by lazy-loaded recommendation cards.
        root.addView(view, 0, FrameLayout.LayoutParams((1280 * resources.displayMetrics.density).toInt(),
            (900 * resources.displayMetrics.density).toInt()))
        var finished = false
        var pollStarted = false
        var pageLoaded = false
        var navigation = 0
        var stableCount = 0
        var anonymousCount = 0
        var lastItems = ""
        var scrolled = false
        val searchMode = platform.optString("pageType") == "search"
        var latest = JSONObject()
        lateinit var poll: Runnable
        val timeout = Runnable {
            if (!finished) {
                finished = true
                handler.removeCallbacks(poll)
                scrapers.remove(view)
                root.removeView(view)
                view.stopLoading()
                view.destroy()
                complete(if (authMode) JSONObject().put("confirmedAuth", "unknown")
                    else if ((latest.optJSONArray("items")?.length() ?: 0) > 0) latest
                    else JSONObject().put("error", "官网连接超时"))
            }
        }
        fun finish(result: JSONObject) {
            if (finished) return
            finished = true
            handler.removeCallbacks(timeout)
            handler.removeCallbacks(poll)
            scrapers.remove(view)
            root.removeView(view)
            view.stopLoading()
            view.destroy()
            complete(result)
        }
        poll = object : Runnable {
            override fun run() {
                if (finished || destroyed) return
                val generation = navigation
                snapshot(view, platform, authMode) { result ->
                    if (finished || generation != navigation) return@snapshot
                    latest = result
                    val ready = pageLoaded || result.optBoolean("ready")
                    val auth = if (result.optBoolean("challenged")) "unknown" else authState(platform, result)
                    anonymousCount = if (ready && auth == "anonymous") anonymousCount + 1 else 0
                    result.put("confirmedAuth", if (auth == "authenticated") auth
                        else if (anonymousCount >= 2) "anonymous" else "unknown")
                    val items = result.optJSONArray("items") ?: JSONArray()
                    val signature = (0 until items.length()).joinToString("|") {
                        val item = items.getJSONObject(it)
                        item.optString("key") + if (searchMode) ":${item.optString("cover")}" else ""
                    }
                    val firstScreenHasCovers = !searchMode || (0 until minOf(24, items.length())).all {
                        items.getJSONObject(it).optString("cover").isNotBlank()
                    }
                    stableCount = if (ready && signature == lastItems) stableCount + 1 else if (ready) 1 else 0
                    lastItems = signature
                    if (result.optBoolean("challenged") || (authMode && result.optString("confirmedAuth") != "unknown")
                        || (!authMode && ((detailMode && !result.optJSONObject("detail")?.optString("description").isNullOrBlank())
                            || (items.length() >= 24 && firstScreenHasCovers) || result.optBoolean("empty") || stableCount >= 3))) {
                        finish(result)
                    } else {
                        if (!authMode && !scrolled && ready && stableCount >= 2) {
                            scrolled = true
                            stableCount = 0
                            view.evaluateJavascript("window.scrollTo(0,900)", null)
                        }
                        handler.postDelayed(this, 500)
                    }
                }
            }
        }
        fun startPoll() {
            if (!finished && !pollStarted) { pollStarted = true; handler.post(poll) }
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(webView: WebView, request: WebResourceRequest) = !allowed(platform, request.url.toString())
            override fun onPageStarted(webView: WebView, url: String, favicon: android.graphics.Bitmap?) {
                navigation += 1
                handler.removeCallbacks(poll)
                pollStarted = false
                pageLoaded = false
                stableCount = 0
                anonymousCount = 0
                lastItems = ""
                scrolled = false
                latest = JSONObject()
            }
            override fun onPageCommitVisible(webView: WebView, url: String) = startPoll()
            override fun onPageFinished(webView: WebView, url: String) {
                pageLoaded = true
                startPoll()
            }
            override fun onReceivedError(webView: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) finish(JSONObject().put("error", error.description.toString()))
            }
        }
        handler.postDelayed(timeout, if (authMode) 10000 else 30000)
        view.loadUrl(url)
        return { finish(JSONObject().put("error", "搜索请求已被新批次取消")) }
    }

    private fun startListTasks() {
        while (!destroyed && runningLists < 5 && listQueue.isNotEmpty()) {
            val task = listQueue.removeFirst()
            if (listTasks[task.key] !== task) continue
            if (task.batch != null && task.batch != searchBatch) {
                listTasks.remove(task.key)
                task.requests.forEach { respond(it, error = "搜索批次已变化") }
                continue
            }
            runningLists += 1
            task.cancel = readPage(task.platform, task.url) { result ->
                runningLists -= 1
                listTasks.remove(task.key)
                if (task.batch == null || task.batch == searchBatch) {
                    val auth = result.optString("confirmedAuth", "unknown")
                    rememberAuth(task.platform, auth)
                    if (listRevisions[task.cacheKey] == task.revision && !result.has("error")
                        && !result.optBoolean("challenged")
                        && ((result.optJSONArray("items")?.length() ?: 0) > 0 || result.optBoolean("empty"))) {
                        listCache[task.cacheKey] = Pair(result, task.page)
                    }
                    val response = listResult(result, task.page, task.page,
                        if (auth == "unknown") cachedAuth(task.platform) ?: "unknown" else auth)
                    task.requests.forEach { respond(it, response) }
                } else task.requests.forEach { respond(it, error = "搜索批次已变化") }
                startListTasks()
            }
        }
    }

    private fun authState(platform: JSONObject, page: JSONObject): String {
        if (page.optString("auth") == "anonymous") return "anonymous"
        val cookies = CookieManager.getInstance().getCookie(platform.getString("home")).orEmpty()
            .split(';').map { it.trim() }.filter { it.contains('=') && it.substringAfter('=').isNotBlank() }
            .map { it.substringBefore('=') }.toSet()
        val names = platform.getJSONArray("authCookies")
        val hasSession = (0 until names.length()).any { names.getString(it) in cookies }
        return if (page.optString("auth") == "authenticated" && hasSession) "authenticated" else "unknown"
    }

    private fun cookieFingerprint(platform: JSONObject): String {
        val names = platform.getJSONArray("authCookies")
        val keys = (0 until names.length()).map { names.getString(it) }.toSet()
        val values = CookieManager.getInstance().getCookie(platform.getString("home")).orEmpty()
            .split(';').map { it.trim() }.filter { it.substringBefore('=') in keys }.sorted().joinToString(";")
        return MessageDigest.getInstance("SHA-256").digest(values.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    private fun cachedAuth(platform: JSONObject): String? {
        val key = platform.getString("id")
        val confirmation = authCache[key] ?: return null
        if (SystemClock.elapsedRealtime() - confirmation.checkedAt >= 300000
            || cookieFingerprint(platform) != confirmation.fingerprint) { authCache.remove(key); return null }
        return "authenticated"
    }

    private fun rememberAuth(platform: JSONObject, auth: String) {
        val key = platform.getString("id")
        if (auth == "authenticated") {
            authCache[key] = AuthConfirmation(SystemClock.elapsedRealtime(), cookieFingerprint(platform))
            getSharedPreferences("session-history", MODE_PRIVATE).edit().putLong(key, System.currentTimeMillis()).apply()
        } else if (auth == "anonymous") authCache.remove(key)
        if (auth != "unknown") emit(JSONObject().put("type", "auth-state").put("platform", key).put("auth", auth))
    }

    private fun checkAuth(platform: JSONObject, complete: (String) -> Unit) {
        val cached = cachedAuth(platform)
        if (cached != null) { complete(cached); return }
        readPage(platform, platform.getString("home"), authMode = true) { page ->
            val auth = page.optString("confirmedAuth", "unknown")
            rememberAuth(platform, auth)
            complete(auth)
        }
    }

    private fun flushCookies(complete: ((String?) -> Unit)? = null) {
        if (complete != null) cookieFlushWaiters.add(complete)
        if (cookieFlushRunning) { cookieFlushAgain = true; return }
        cookieFlushRunning = true
        cookieWriter.execute {
            val error = try { CookieManager.getInstance().flush(); null }
                catch (_: RuntimeException) { "登录会话保存失败，请重试" }
            handler.post {
                cookieFlushRunning = false
                if (cookieFlushAgain && !cookieWriter.isShutdown && error == null) {
                    cookieFlushAgain = false
                    flushCookies()
                } else {
                    cookieFlushAgain = false
                    val waiters = cookieFlushWaiters.toList()
                    cookieFlushWaiters.clear()
                    if (!destroyed) {
                        if (error != null && waiters.isEmpty()) emit(JSONObject().put("type", "notice").put("message", error))
                        waiters.forEach { it(error) }
                    }
                }
            }
        }
    }

    private fun listResult(result: JSONObject, page: Int, startPage: Int, auth: String = "unknown"): JSONObject {
        val items = result.optJSONArray("items") ?: JSONArray()
        val status = when {
            result.has("error") -> "network-error"
            result.optBoolean("challenged") -> "verification"
            items.length() > 0 -> "ok"
            result.optBoolean("empty") -> "empty"
            else -> "parse-error"
        }
        val message = when (status) {
            "network-error" -> result.optString("error")
            "verification" -> "官网要求安全验证，请在官网完成后重试"
            "empty" -> "没有找到相关内容"
            "parse-error" -> "官网已打开，但暂时无法读取影片信息"
            else -> ""
        }
        val offset = (page - startPage).coerceAtLeast(0) * 24
        val slice = JSONArray()
        for (index in offset until minOf(offset + 24, items.length())) slice.put(items.get(index))
        val localMore = items.length() > offset + 24
        val nextUrl = if (localMore) JSONObject.NULL else result.opt("nextUrl")
        return JSONObject().put("status", status).put("items", slice).put("message", message)
            .put("auth", auth)
            .put("nextUrl", nextUrl).put("hasMore", localMore || (!result.isNull("nextUrl") && result.optString("nextUrl").isNotBlank()))
    }

    private fun closeRemote() {
        if (remote != null) flushCookies()
        stopPlayerPoll()
        playerSession += 1
        leaveFullscreen()
        remote?.let { view -> root.removeView(view); view.stopLoading(); view.destroy() }
        remote = null
        remotePlatform = null
        pendingVideo = null
        remoteMode = ""
        unifiedPlayer = false
    }

    private fun showRemote(platform: JSONObject, url: String, mode: String, video: JSONObject? = null) {
        closeRemote()
        remotePlatform = platform
        remoteMode = mode
        pendingVideo = video
        unifiedPlayer = mode == "play"
        remote = officialView(platform, true)
        if (unifiedPlayer) remote?.setInitialScale(100)
        root.addView(remote, FrameLayout.LayoutParams(-1, 1).apply { topMargin = (170 * resources.displayMetrics.density).toInt() })
        emit(JSONObject().put("type", "browser").put("mode", mode).put("platform", platform.getString("id"))
            .put("title", video?.optString("title") ?: platform.getString("name"))
            .put("description", video?.optString("description").orEmpty()).put("session", playerSession))
        remote?.loadUrl(url)
    }

    private fun stopPlayerPoll() {
        playerPolling = false
        playerPollGeneration += 1
        handler.removeCallbacks(playerPoll)
    }

    private fun startPlayerPoll() {
        if (playerPolling || !foreground || !unifiedPlayer || remoteMode != "play") return
        playerPolling = true
        handler.post(playerPoll)
    }

    private fun pollPlayer() {
        if (!playerPolling || !foreground || !unifiedPlayer || remote == null) return
        val session = playerSession
        val generation = playerPollGeneration
        evaluatePlayer("snapshot", JSONObject()) { result ->
            if (session != playerSession || generation != playerPollGeneration || !playerPolling) return@evaluatePlayer
            val requestedFullscreen = result.opt("fullscreenRequest") as? Boolean
            if (requestedFullscreen != null && requestedFullscreen != playerFullscreen) setPlayerFullscreen(requestedFullscreen)
            emit(JSONObject().put("type", "player-state").put("session", session).put("state", result))
            handler.postDelayed(playerPoll, 1000)
        }
    }

    private fun evaluatePlayer(operation: String, payload: JSONObject, complete: (JSONObject) -> Unit) {
        val view = remote
        val config = remotePlatform
        if (view == null || config == null || remoteMode != "play" || !allowed(config, view.url.orEmpty())) {
            complete(JSONObject().put("error", "播放页面尚未就绪")); return
        }
        val session = playerSession
        val platform = JSONObject.quote(config.getString("id"))
        val type = JSONObject.quote(pendingVideo?.optString("mediaType").orEmpty())
        val invocation = when (operation) {
            "snapshot" -> "SimplePlayer.snapshot()"
            "mode" -> "SimplePlayer.mode(${payload.optBoolean("compact")})"
            "fullscreen" -> "SimplePlayer.fullscreen($playerFullscreen)"
            else -> "SimplePlayer.action(${JSONObject.quote(operation)},$payload)"
        }
        val fullscreenSync = if (operation == "fullscreen") "" else "SimplePlayer.fullscreen($playerFullscreen);"
        val script = """(() => {
            try {
                if (!globalThis.SimplePlayer) {
                    $playerScript
                    SimplePlayer.init($platform,$type,$unifiedPlayer);
                }
                $fullscreenSync
                return JSON.stringify($invocation);
            } catch (_) { return JSON.stringify({error:'官网播放适配未完成，请进入官网操作'}); }
        })()""".trimIndent()
        view.evaluateJavascript(script) { encoded ->
            if (destroyed) return@evaluateJavascript
            if (view !== remote || session != playerSession) {
                complete(JSONObject().put("error", "播放页面已变化")); return@evaluateJavascript
            }
            val result = try {
                val decoded = JSONTokener(encoded).nextValue() as? String
                if (decoded != null && decoded.length <= 256000) JSONObject(decoded)
                else JSONObject().put("error", "无法读取官网播放状态")
            } catch (_: org.json.JSONException) { JSONObject().put("error", "无法读取官网播放状态") }
            complete(result)
        }
    }

    private fun setPlayerFullscreen(enabled: Boolean) {
        if (playerFullscreen == enabled) return
        if (enabled) previousOrientation = requestedOrientation
        playerFullscreen = enabled
        if (!enabled) removeFullscreenView(true)
        if (unifiedPlayer && remoteMode == "play") evaluatePlayer("fullscreen", JSONObject()) { result ->
            if (result.has("error")) emit(JSONObject().put("type", "notice").put("message", result.optString("error")))
        }
        if (enabled) {
            remote?.layoutParams = FrameLayout.LayoutParams(-1, -1)
            if (fullscreenView == null) root.bringChildToFront(shell)
        } else remote?.bringToFront()
        requestedOrientation = if (enabled) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else previousOrientation
        emit(JSONObject().put("type", "player-fullscreen").put("enabled", enabled))
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            if (enabled) {
                window.insetsController?.hide(WindowInsets.Type.systemBars())
                window.insetsController?.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else window.insetsController?.show(WindowInsets.Type.systemBars())
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (enabled) View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            else View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        applySystemTheme(darkTheme)
        root.requestApplyInsets()
    }

    private fun dispatch(request: JSONObject) {
        val id = request.optInt("id")
        val payload = request.optJSONObject("payload") ?: JSONObject()
        val command = request.optString("command")
        val platform = platforms[payload.optString("platform")]
        if (command in listOf("list", "detail", "login", "auth", "open", "verify") && platform == null) {
            respond(id, error = "未知平台"); return
        }
        when (command) {
            "checkUpdate" -> { updates.check(); respond(id, updates.snapshot()) }
            "updateStatus" -> respond(id, updates.snapshot())
            "downloadUpdate" -> {
                val error = updates.download(payload.optLong("releaseId", -1), payload.optLong("assetId", -1))
                if (error != null) respond(id, error = error) else respond(id, updates.snapshot())
            }
            "installUpdate" -> updates.install { message, error ->
                if (error != null) respond(id, error = error) else respond(id, JSONObject().put("message", message))
            }
            "playerAction" -> {
                if (remoteMode != "play" || !unifiedPlayer || payload.optInt("session", -1) != playerSession) {
                    respond(id, error = "播放页面已变化，请重试"); return
                }
                val operation = payload.optString("action")
                if (operation !in listOf("play", "pause", "seek", "quality", "episode", "qualityMenu", "episodeGroup", "episodeMore")) {
                    respond(id, error = "不支持的播放操作"); return
                }
                if (operation == "seek" && !payload.optDouble("position", Double.NaN).isFinite()) {
                    respond(id, error = "无效播放进度"); return
                }
                evaluatePlayer(operation, payload) { result ->
                    if (result.has("error")) respond(id, error = result.optString("error")) else respond(id, result)
                }
            }
            "playerMode" -> {
                if (remoteMode != "play" || payload.optInt("session", -1) != playerSession) {
                    respond(id, error = "播放页面已变化"); return
                }
                if (playerFullscreen) setPlayerFullscreen(false)
                val compact = payload.optBoolean("compact")
                evaluatePlayer("mode", JSONObject().put("compact", compact)) { result ->
                    if (result.has("error")) respond(id, error = result.optString("error"))
                    else {
                        unifiedPlayer = compact
                        if (compact) { remote?.setInitialScale(100); startPlayerPoll() }
                        else {
                            stopPlayerPoll()
                            remote?.setInitialScale((resources.displayMetrics.widthPixels / resources.displayMetrics.density / 1280 * 100).toInt())
                        }
                        emit(JSONObject().put("type", "player-mode").put("compact", compact))
                        respond(id, result)
                    }
                }
            }
            "playerFullscreen" -> {
                if (remoteMode != "play" || !unifiedPlayer || payload.optInt("session", -1) != playerSession) {
                    respond(id, error = "当前不能全屏"); return
                }
                setPlayerFullscreen(payload.optBoolean("enabled")); respond(id)
            }
            "theme" -> {
                val theme = payload.optString("theme")
                if (theme != "light" && theme != "dark") { respond(id, error = "未知主题"); return }
                applySystemTheme(theme == "dark")
                respond(id)
            }
            "info" -> respond(id, JSONObject().put("runtime", "Android ${android.os.Build.VERSION.RELEASE} · ${WebView.getCurrentWebViewPackage()?.versionName ?: "系统 WebView"}")
                .put("lastConfirmed", JSONObject().apply {
                    val history = getSharedPreferences("session-history", MODE_PRIVATE)
                    platforms.keys.forEach { key -> put(key, history.getLong(key, 0)) }
                })
                .put("systemDark", systemIsDark())
                .put("drm", JSONObject().put("state", "system").put("message", "DRM 与播放能力由系统 WebView 和官网决定")))
            "searchBegin" -> {
                val batch = payload.optInt("batch", -1)
                val query = payload.optString("query").trim().take(120)
                if (batch <= searchBatch || query.isBlank()) { respond(id, error = "无效搜索批次"); return }
                searchBatch = batch
                searchQuery = query
                // Invalidate ownership before cancelling: callbacks cannot publish or cache old searches.
                val stale = listTasks.values.filter { it.batch != null && it.batch != batch }
                stale.forEach { task ->
                    if (listTasks[task.key] !== task) return@forEach
                    val cancel = task.cancel
                    if (cancel != null) cancel()
                    else {
                        listQueue.remove(task)
                        listTasks.remove(task.key)
                        task.requests.forEach { respond(it, error = "搜索批次已变化") }
                    }
                }
                val homeKeys = platforms.keys.map { "$it:" }.toSet()
                listCache.keys.filter { it !in homeKeys }.toList().forEach { listCache.remove(it) }
                listRevisions.keys.filter { it !in homeKeys }.toList().forEach { listRevisions.remove(it) }
                respond(id)
                startListTasks()
            }
            "list" -> {
                val config = platform!!
                val query = payload.optString("query").trim().take(120)
                val batch = if (query.isNotEmpty()) payload.optInt("batch", -1) else null
                if (batch != null && (batch != searchBatch || query != searchQuery)) {
                    respond(id, error = "搜索批次已变化"); return
                }
                val page = payload.optInt("page", 1).coerceIn(1, 100)
                val url = payload.optString("nextUrl").takeIf { it.isNotBlank() }
                    ?: if (query.isEmpty()) config.getString("home") else config.getString("search")
                        .replace("{query}", Uri.encode(query)).replace("{page}", page.toString())
                if (!allowed(config, url)) { respond(id, error = "不允许的官网地址"); return }
                val cacheKey = if (batch == null) "${config.getString("id")}:"
                    else "${config.getString("id")}:$batch:$query"
                val cached = listCache[cacheKey]
                if (page > 1 && payload.optString("nextUrl").isBlank() && cached != null) {
                    respond(id, listResult(cached.first, page, cached.second, cachedAuth(config) ?: "unknown")); return
                }
                val requestKey = "$cacheKey:$page:$url"
                val running = listTasks[requestKey]
                if (running != null) { running.requests.add(id); return }
                val extractionConfig = if (query.isNotEmpty()) JSONObject(config.toString()).put("pageType", "search") else config
                val revision = ++nextListRevision
                listRevisions[cacheKey] = revision
                val task = ListTask(requestKey, cacheKey, extractionConfig, url, page, batch, revision, mutableListOf(id))
                listTasks[requestKey] = task
                listQueue.addLast(task)
                startListTasks()
            }
            "detail" -> {
                val config = platform!!
                val url = payload.optString("url")
                if (!allowed(config, url)) { respond(id, error = "不允许的影片地址"); return }
                readPage(config, url, true) { result ->
                    if (result.has("error")) respond(id, error = result.optString("error"))
                    else respond(id, JSONObject().put("detail", result.opt("detail")).put("status",
                        if (result.optBoolean("challenged")) "verification" else if (!result.isNull("detail")) "ok" else "parse-error"))
                }
            }
            "login" -> { browserGeneration += 1; showRemote(platform!!, platform.getString("login"), "login"); respond(id) }
            "verify" -> {
                browserGeneration += 1
                val config = platform!!
                verificationQuery = payload.optString("query").trim().take(120)
                val url = if (verificationQuery.isEmpty()) config.getString("home") else config.getString("search")
                    .replace("{query}", Uri.encode(verificationQuery)).replace("{page}", "1")
                showRemote(config, url, "verify")
                respond(id)
            }
            "finishVerification" -> {
                if (remoteMode == "verify") {
                    val selected = remotePlatform!!.getString("id")
                    val query = verificationQuery
                    closeRemote()
                    emit(JSONObject().put("type", "browser-closed"))
                    emit(JSONObject().put("type", "verified").put("platform", selected).put("query", query))
                }
                respond(id)
            }
            "auth" -> checkAuth(platform!!) { auth -> respond(id, JSONObject().put("auth", auth)) }
            "open" -> {
                val config = platform!!
                val url = payload.optString("url")
                if (!allowed(config, url)) { respond(id, error = "不允许的影片地址"); return }
                val video = JSONObject().put("url", url).put("title", payload.optString("title", config.getString("name")).take(120))
                    .put("description", payload.optString("description").take(4000))
                    .put("mediaType", payload.optString("mediaType").take(20))
                val generation = ++browserGeneration
                checkAuth(config) { auth ->
                    if (generation != browserGeneration) { respond(id, JSONObject().put("cancelled", true)); return@checkAuth }
                    showRemote(config, if (auth == "authenticated") url else config.getString("login"),
                        if (auth == "authenticated") "play" else "login", video)
                    respond(id, JSONObject().put("auth", auth))
                }
            }
            "finishLogin" -> {
                val view = remote
                val config = remotePlatform
                if (view == null || config == null || remoteMode != "login") { respond(id, JSONObject().put("auth", "unknown")); return }
                snapshot(view, config, true) { page ->
                    val auth = authState(config, page)
                    if (view !== remote) { respond(id, error = "登录页面已变化"); return@snapshot }
                    if (auth == "authenticated" && !page.optBoolean("challenged")) {
                        rememberAuth(config, auth)
                        val generation = browserGeneration
                        flushCookies { error ->
                            if (error != null) respond(id, error = error)
                            else if (view !== remote || generation != browserGeneration) respond(id, error = "登录页面已变化")
                            else {
                                val video = pendingVideo
                                if (video != null) showRemote(config, video.getString("url"), "play", video)
                                else { closeRemote(); emit(JSONObject().put("type", "browser-closed")) }
                                respond(id, JSONObject().put("auth", auth))
                            }
                        }
                    } else if (auth == "anonymous" && page.optBoolean("ready") && !page.optBoolean("challenged")) {
                        handler.postDelayed({
                            if (view !== remote) respond(id, error = "登录页面已变化")
                            else snapshot(view, config, true) { confirmed ->
                                if (view !== remote) respond(id, error = "登录页面已变化")
                                else {
                                    val anonymous = confirmed.optBoolean("ready") && !confirmed.optBoolean("challenged")
                                        && authState(config, confirmed) == "anonymous"
                                    if (anonymous) rememberAuth(config, "anonymous")
                                    respond(id, JSONObject().put("auth", if (anonymous) "anonymous" else "unknown"))
                                }
                            }
                        }, 500)
                    } else {
                        respond(id, JSONObject().put("auth", "unknown"))
                    }
                }
            }
            "browserClose" -> { browserGeneration += 1; closeRemote(); respond(id) }
            "browserBack" -> { if (remote?.canGoBack() == true) remote?.goBack(); respond(id) }
            "browserReload" -> { remote?.reload(); respond(id) }
            "bounds" -> {
                val rect = payload.optJSONObject("rect")
                if (rect != null && remote != null) {
                    val density = resources.displayMetrics.density
                    val parameters = FrameLayout.LayoutParams((rect.optDouble("width", 1.0) * density).toInt().coerceIn(1, root.width.coerceAtLeast(1)),
                        (rect.optDouble("height", 1.0) * density).toInt().coerceIn(1, root.height.coerceAtLeast(1)))
                    parameters.leftMargin = (rect.optDouble("x") * density).toInt().coerceAtLeast(0)
                    parameters.topMargin = (rect.optDouble("y") * density).toInt().coerceAtLeast(0)
                    remote?.layoutParams = if (playerFullscreen) FrameLayout.LayoutParams(-1, -1) else parameters
                }
                respond(id)
            }
            else -> respond(id, error = "不支持的操作")
        }
    }

    private fun removeFullscreenView(notifyPage: Boolean) {
        if (fullscreenView == null) return
        val callback = fullscreenCallback
        fullscreenView?.let { root.removeView(it) }
        fullscreenView = null
        fullscreenCallback = null
        if (::shell.isInitialized) shell.visibility = View.VISIBLE
        remote?.visibility = View.VISIBLE
        // Clear ownership before notifying WebView; it may call onHideCustomView synchronously.
        if (notifyPage) callback?.onCustomViewHidden()
    }

    private fun leaveFullscreen() {
        removeFullscreenView(true)
        if (playerFullscreen) setPlayerFullscreen(false)
    }

    @Deprecated("Activity back dispatch")
    override fun onBackPressed() = handleBack()

    private fun handleBack() {
        when {
            playerFullscreen -> setPlayerFullscreen(false)
            fullscreenView != null -> leaveFullscreen()
            remoteMode == "play" && !unifiedPlayer -> {
                evaluatePlayer("mode", JSONObject().put("compact", true)) { result ->
                    if (result.has("error")) emit(JSONObject().put("type", "notice").put("message", result.optString("error")))
                    else {
                        unifiedPlayer = true
                        remote?.setInitialScale(100)
                        emit(JSONObject().put("type", "player-mode").put("compact", true))
                        startPlayerPoll()
                    }
                }
            }
            remoteMode == "play" -> { browserGeneration += 1; closeRemote(); emit(JSONObject().put("type", "browser-closed")) }
            remote?.canGoBack() == true -> remote?.goBack()
            remote != null -> { browserGeneration += 1; closeRemote(); emit(JSONObject().put("type", "browser-closed")) }
            else -> shell.evaluateJavascript("""(() => {
                const dialog = document.querySelector('#detail-dialog');
                if(dialog.open) { dialog.close(); return true; }
                if(document.querySelector('#page-home').hidden) {
                    document.querySelector('[data-tab="home"]').click(); return true;
                }
                return false;
            })()""".trimIndent()) { result -> if (result != "true") finish() }
        }
    }

    override fun onPause() {
        foreground = false
        stopPlayerPoll()
        super.onPause()
        remote?.onPause()
        flushCookies()
    }
    override fun onResume() {
        super.onResume()
        foreground = true
        remote?.onResume()
        startPlayerPoll()
    }
    override fun onDestroy() {
        destroyed = true
        updates.close()
        handler.removeCallbacksAndMessages(null)
        listQueue.clear()
        listTasks.clear()
        closeRemote()
        cookieWriter.shutdown()
        scrapers.forEach { it.stopLoading(); it.destroy() }
        scrapers.clear()
        shell.removeJavascriptInterface("AndroidBridge")
        shell.destroy()
        super.onDestroy()
    }
}
