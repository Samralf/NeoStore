package com.neocoffee.smsgateway;

import android.content.*;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;

public final class MessageLog {
 private static final String PREFS="sms_report",KEY="entries";
 private MessageLog(){}
 public static synchronized void add(Context c,String phone,String type,String sim,String result){
  try{SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);JSONArray a=new JSONArray(p.getString(KEY,"[]"));JSONObject o=new JSONObject();o.put("time",System.currentTimeMillis());o.put("phone",mask(phone));o.put("type",type);o.put("sim",sim);o.put("result",result);a.put(o);while(a.length()>2000)a.remove(0);p.edit().putString(KEY,a.toString()).apply();}catch(Exception ignored){}
 }
 public static synchronized boolean confirmLatestTest(Context c){
  try{SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);JSONArray a=new JSONArray(p.getString(KEY,"[]"));for(int i=a.length()-1;i>=0;i--){JSONObject o=a.getJSONObject(i);if("اختبار".equals(o.optString("type"))){o.put("result","confirmed");p.edit().putString(KEY,a.toString()).apply();return true;}}}catch(Exception ignored){}return false;
 }
 public static String report(Context c,long from,long to){
  int total=0,sent=0,failed=0,pending=0;StringBuilder rows=new StringBuilder();SimpleDateFormat f=new SimpleDateFormat("dd/MM/yyyy HH:mm",new Locale("ar"));
  try{JSONArray a=new JSONArray(c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(KEY,"[]"));for(int i=a.length()-1;i>=0;i--){JSONObject o=a.getJSONObject(i);long t=o.optLong("time");if(t<from||t>to)continue;total++;String r=o.optString("result");if("sent".equals(r)||"confirmed".equals(r))sent++;else if("failed".equals(r))failed++;else pending++;rows.append(f.format(new Date(t))).append(" • ").append(o.optString("type")).append(" • ").append(o.optString("phone")).append("\n").append(o.optString("sim")).append(" — ").append(label(r)).append("\n\n");}}catch(Exception ignored){}
  return "الإجمالي: "+total+"   ناجح: "+sent+"   فاشل: "+failed+"   قيد الإرسال: "+pending+(rows.length()==0?"\n\nلا توجد رسائل في الفترة المحددة":"\n\n"+rows);
 }
 private static String mask(String p){if(p==null)return "";return p.length()>7?p.substring(0,4)+"***"+p.substring(p.length()-4):p;}
 private static String label(String r){return "confirmed".equals(r)?"تم تأكيد الوصول":"sent".equals(r)?"تم الإرسال":"failed".equals(r)?"فشل الإرسال":"قيد الإرسال";}
}
