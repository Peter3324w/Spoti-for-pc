plugins {
    application
    alias(libs.plugins.kotlin.jvm)
}
kotlin { jvmToolchain(17) }
dependencies {
    implementation(project(":host-cdp"))
    implementation("com.google.code.gson:gson:2.13.2")
    testImplementation(platform(libs.junit.bom))
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.launcher)
}
application { mainClass.set("app.myspoti.desktop.MainKt") }
tasks.test {
    useJUnitPlatform()
    // Reproduce the default code page on Java 17 Windows installations.
    jvmArgs("-Dfile.encoding=windows-1252")
}
