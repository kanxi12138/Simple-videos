plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.simplevideos.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.simplevideos.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1000021
        versionName = "1.0.21"
    }
    signingConfigs {
        create("release") {
            val signingPath = System.getenv("SIMPLE_VIDEOS_KEYSTORE")
            if (signingPath != null) storeFile = file(signingPath)
            storePassword = System.getenv("SIMPLE_VIDEOS_STORE_PASSWORD")
            keyAlias = "simple-videos"
            keyPassword = System.getenv("SIMPLE_VIDEOS_KEY_PASSWORD")
        }
    }
    buildTypes {
        release { signingConfig = signingConfigs.getByName("release"); isMinifyEnabled = false }
    }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/assets"))
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

val syncFrontend by tasks.registering(Sync::class) {
    from("../../web") { into("web") }
    from("../../shared") { into("shared") }
    into(layout.buildDirectory.dir("generated/assets"))
}
tasks.named("preBuild").configure { dependsOn(syncFrontend) }

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
}
