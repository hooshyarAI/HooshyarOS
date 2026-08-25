package ai.hooshyar.client;

import android.app.Activity;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;

public final class MainActivity extends Activity {
    private static final String PREFS = "hooshyar";
    private static final String SERVER = "server";
    private EditText serverInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String saved = prefs.getString(SERVER, "http://10.0.2.2:4173");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(24, 24, 24, 24);

        serverInput = new EditText(this);
        serverInput.setSingleLine(true);
        serverInput.setHint("Hooshyar runtime URL");
        serverInput.setText(saved);
        root.addView(serverInput, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button connect = new Button(this);
        connect.setText("اتصال به هوشیار");
        root.addView(connect, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        WebView web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient());
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);

        connect.setOnClickListener(v -> {
            String url = serverInput.getText().toString().trim().replaceAll("/$", "");
            if (!url.startsWith("http://") && !url.startsWith("https://")) return;
            prefs.edit().putString(SERVER, url).apply();
            web.loadUrl(url + "/");
        });

        web.loadUrl(saved + "/");
    }
}
