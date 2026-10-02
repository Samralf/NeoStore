plugins { id("com.android.application") }
android { namespace = "com.neocoffee.smsgateway"; compileSdk = 36
 defaultConfig { applicationId = "com.neocoffee.smsgateway"; minSdk = 26; targetSdk = 36; versionCode = 11; versionName = "1.5.1" }
 buildTypes { release { isMinifyEnabled = false } }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
