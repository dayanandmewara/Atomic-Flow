package app.netlify.dmhabits2;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Toast;
import java.util.HashSet;
import java.util.Set;

public class AppBlockerService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence pkgNameChar = event.getPackageName();
            if (pkgNameChar == null) {
                return;
            }
            
            String packageName = pkgNameChar.toString();
            
            // Skip checking our own app to prevent redirect loops
            if (packageName.equals("app.netlify.dmhabits2")) {
                return;
            }

            SharedPreferences prefs = getSharedPreferences("AppBlockerPrefs", Context.MODE_PRIVATE);
            Set<String> blockedPkgs = prefs.getStringSet("blocked_packages", new HashSet<String>());

            if (blockedPkgs.contains(packageName)) {
                long expiry = prefs.getLong("unlock_expiry_" + packageName, 0);
                long now = System.currentTimeMillis();

                // If not unlocked or unlock expired
                if (now > expiry) {
                    // 1. Kick the user back to Home Screen
                    performGlobalAction(GLOBAL_ACTION_HOME);

                    // 2. Launch the AtomicFlow habit app to prompt completion
                    Intent launchIntent = getPackageManager().getLaunchIntentForPackage("app.netlify.dmhabits2");
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        launchIntent.putExtra("blocked_app_trigger", packageName);
                        startActivity(launchIntent);
                    }

                    // 3. Show Toast notification explaining why
                    Toast.makeText(
                        getApplicationContext(), 
                        "🔒 App locked! Complete habits to earn coins and unlock it.", 
                        Toast.LENGTH_LONG
                    ).show();
                }
            }
        }
    }

    @Override
    public void onInterrupt() {
        // Required method for AccessibilityService
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        // Configure service info if needed
    }
}
