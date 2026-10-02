# Neo Coffee SMS Gateway

Private Android companion app that sends website OTP messages through the shop phone SIM.

## Ready-to-install APK

The current debug APK is available at:

`../releases/Neo-SMS-Gateway-v1.2.0-debug.apk`

Copy it to the Android phone, allow installation from the selected file manager,
then install it. Android 8.0 or newer is required.

1. Open this folder in Android Studio and install the debug APK on the shop phone.
2. Enter the deployed HTTPS store URL and the same `SMS_GATEWAY_TOKEN` configured on the server.
3. Grant SMS and notification permissions, then tap **حفظ وتشغيل الإرسال**.
4. Exclude the app from battery optimization for reliable continuous operation.

The store URL must be the deployed HTTPS address; `localhost` will not work from
the phone. Keep the gateway phone connected to the internet and ensure the SIM
has an active SMS balance or bundle.

The phone receives only the SMS job ID, destination number, OTP message, attempt count, and creation time. It never receives customer passwords or order details.
