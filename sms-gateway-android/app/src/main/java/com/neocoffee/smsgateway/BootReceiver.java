package com.neocoffee.smsgateway;

import android.content.*;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  boolean enabled=context.getSharedPreferences("gateway",Context.MODE_PRIVATE).getBoolean("running",false);
  if(!enabled)return;
  Intent service=new Intent(context,GatewayService.class);
  if(Build.VERSION.SDK_INT>=26)context.startForegroundService(service);else context.startService(service);
 }
}
