package app.netlify.dmhabits2;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "AppBlocker")
public class AppBlockerPlugin extends Plugin {

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences("AppBlockerPrefs", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void setBlockedApps(PluginCall call) {
        try {
            JSONArray appsArray = call.getArray("blockedApps");
            if (appsArray == null) {
                call.reject("blockedApps parameter is required");
                return;
            }

            Set<String> appSet = new HashSet<>();
            for (int i = 0; i < appsArray.length(); i++) {
                appSet.add(appsArray.getString(i));
            }

            SharedPreferences.Editor editor = getPrefs().edit();
            editor.putStringSet("blocked_packages", appSet);
            editor.apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to set blocked apps: " + e.getMessage());
        }
    }

    @PluginMethod
    public void unlockApp(PluginCall call) {
        String packageName = call.getString("packageName");
        Integer durationSeconds = call.getInt("durationSeconds");

        if (packageName == null || durationSeconds == null) {
            call.reject("packageName and durationSeconds parameters are required");
            return;
        }

        long expiryTime = System.currentTimeMillis() + (durationSeconds * 1000L);
        SharedPreferences.Editor editor = getPrefs().edit();
        editor.putLong("unlock_expiry_" + packageName, expiryTime);
        editor.apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("expiryTime", expiryTime);
        call.resolve(ret);
    }

    @PluginMethod
    public void getBlockedAppsStatus(PluginCall call) {
        SharedPreferences prefs = getPrefs();
        Set<String> blockedPkgs = prefs.getStringSet("blocked_packages", new HashSet<String>());
        
        JSObject ret = new JSObject();
        JSObject statusList = new JSObject();
        long now = System.currentTimeMillis();

        for (String pkg : blockedPkgs) {
            long expiry = prefs.getLong("unlock_expiry_" + pkg, 0);
            long timeRemaining = (expiry - now) / 1000;
            if (timeRemaining < 0) {
                timeRemaining = 0;
            }
            
            JSObject appStatus = new JSObject();
            appStatus.put("isUnlocked", timeRemaining > 0);
            appStatus.put("timeRemainingSeconds", timeRemaining);
            statusList.put(pkg, appStatus);
        }

        ret.put("status", statusList);
        call.resolve(ret);
    }
}
