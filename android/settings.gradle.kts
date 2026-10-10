pluginManagement {
    repositories { maven("https://maven.aliyun.com/repository/google"); google(); mavenCentral(); gradlePluginPortal() }
    resolutionStrategy {
        eachPlugin {
            if (requested.id.id == "com.android.application") useModule("com.android.tools.build:gradle:${requested.version}")
            if (requested.id.id == "org.jetbrains.kotlin.android") useModule("org.jetbrains.kotlin:kotlin-gradle-plugin:${requested.version}")
        }
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven("https://maven.aliyun.com/repository/google") {
            content { includeGroupByRegex("androidx.*"); includeGroupByRegex("com.android.*"); includeGroupByRegex("com.google.*") }
        }
        google(); mavenCentral()
    }
}
rootProject.name = "SimpleVideos"
include(":app")
