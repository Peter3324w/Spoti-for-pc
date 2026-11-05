// Keep the Android build unchanged and compile the shared JVM modules with the installed JDK.
plugins { alias(libs.plugins.kotlin.jvm) apply false }
check(JavaVersion.current().isCompatibleWith(JavaVersion.VERSION_17)) { "Install Java 17 or later to build Spoti for PC." }
subprojects {
    afterEvaluate {
        extensions.findByType<org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension>()
            ?.jvmToolchain(JavaVersion.current().majorVersion.toInt())
    }
}
