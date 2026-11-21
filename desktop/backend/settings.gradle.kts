// Desktop has its own JVM-only build graph; Android and SDK provisioning remain untouched.
pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal() }
    resolutionStrategy {
        eachPlugin {
            if (requested.id.id == "org.jetbrains.kotlin.jvm") {
                useModule("org.jetbrains.kotlin:kotlin-gradle-plugin:${requested.version}")
            }
        }
    }
}
dependencyResolutionManagement {
    repositories { mavenCentral() }
    versionCatalogs { create("libs") { from(files("../../base/gradle/libs.versions.toml")) } }
}
rootProject.name = "SpotiDesktop"
include(":api", ":api-spotify", ":host-cdp", ":desktop-server")
for (name in listOf("api", "api-spotify", "host-cdp", "desktop-server")) {
    project(":$name").projectDir = file("../../base/$name")
}
