package ai.hooshyar.client;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String PREFS = "hooshyar";
    private static final String SERVER = "server";
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();

    private EditText serverInput;
    private TextView status;
    private Button connect;
    private Button clear;
    private ProgressBar progress;
    private WebView web;
    private LinearLayout connectionPanel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final String saved = getSharedPreferences(PREFS, MODE_PRIVATE).getString(SERVER, "");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(24, 24, 24, 24);
        root.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText("هوشیارOS");
        title.setTextSize(26);
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setPadding(0, 0, 0, 16);
        root.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        connectionPanel = new LinearLayout(this);
        connectionPanel.setOrientation(LinearLayout.VERTICAL);

        TextView explanation = new TextView(this);
        explanation.setText(
                "برای استفاده از هوشیار، آدرس امن Runtime را وارد کنید. " +
                "برنامه قبل از باز کردن داشبورد، اتصال و مسیر /health را بررسی می‌کند."
        );
        explanation.setTextSize(16);
        explanation.setTextColor(Color.DKGRAY);
        explanation.setPadding(0, 0, 0, 16);
        connectionPanel.addView(explanation, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        serverInput = new EditText(this);
        serverInput.setSingleLine(true);
        serverInput.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        serverInput.setHint("https://your-hooshyar-runtime.example");
        serverInput.setText(saved);
        connectionPanel.addView(serverInput, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);

        connect = new Button(this);
        connect.setText("اتصال به هوشیار");
        actions.addView(connect, new LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1
        ));

        clear = new Button(this);
        clear.setText("پاک‌کردن");
        actions.addView(clear, new LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1
        ));

        connectionPanel.addView(actions, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        connectionPanel.addView(progress, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        status = new TextView(this);
        status.setTextSize(15);
        status.setTextColor(Color.DKGRAY);
        status.setPadding(0, 12, 0, 12);
        connectionPanel.addView(status, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        root.addView(connectionPanel, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                status.setText("در حال بارگذاری هوشیار…");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                status.setText("هوشیار متصل است.");
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    status.setText("بارگذاری Runtime ناموفق بود. اتصال و آدرس را بررسی کنید.");
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                status.setText("گواهی امنیتی Runtime معتبر نیست؛ اتصال مسدود شد.");
            }
        });

        root.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1
        ));

        setContentView(root);

        clear.setOnClickListener(v -> {
            serverInput.setText("");
            status.setText("هیچ Runtimeای تنظیم نشده است.");
            web.setVisibility(View.GONE);
            connectionPanel.setVisibility(View.VISIBLE);
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove(SERVER).apply();
        });

        connect.setOnClickListener(v -> connectToRuntime());

        if (saved.startsWith("https://")) {
            status.setText("Runtime ذخیره‌شده یافت شد؛ در حال بررسی اتصال…");
            checkAndOpen(saved);
        } else {
            status.setText("هیچ Runtimeای تنظیم نشده است.");
        }
    }

    private void connectToRuntime() {
        String raw = serverInput.getText().toString().trim();
        if (!isValidHttpsUrl(raw)) {
            status.setText("آدرس نامعتبر است. فقط یک آدرس HTTPS معتبر وارد کنید.");
            return;
        }

        String normalized = normalize(raw);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(SERVER, normalized).apply();
        checkAndOpen(normalized);
    }

    private void checkAndOpen(String endpoint) {
        setBusy(true, "در حال بررسی اتصال امن به Runtime…");

        networkExecutor.execute(() -> {
            HealthResult health = checkHealth(endpoint);
            runOnUiThread(() -> {
                setBusy(false, null);

                if (!health.ok) {
                    web.setVisibility(View.GONE);
                    connectionPanel.setVisibility(View.VISIBLE);
                    status.setText(health.message);
                    return;
                }

                connectionPanel.setVisibility(View.VISIBLE);
                web.setVisibility(View.VISIBLE);
                status.setText("Runtime در دسترس است؛ داشبورد در حال بارگذاری است…");
                web.loadUrl(endpoint + "/");
            });
        });
    }

    private HealthResult checkHealth(String endpoint) {
        HttpURLConnection connection = null;
        try {
            URI base = URI.create(endpoint);
            URI healthUri = new URI(
                    base.getScheme(),
                    base.getRawAuthority(),
                    appendPath(base.getRawPath(), "health"),
                    null,
                    null
            );

            URL healthUrl = healthUri.toURL();
            connection = (HttpURLConnection) healthUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(10000);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);

            int code = connection.getResponseCode();
            boolean ok = code >= 200 && code < 300;
            return ok
                    ? HealthResult.ok()
                    : HealthResult.fail("Runtime پاسخ معتبر نداد. HTTP " + code);
        } catch (Exception error) {
            return HealthResult.fail("Runtime در دسترس نیست. اتصال اینترنت و آدرس Runtime را بررسی کنید.");
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private boolean isValidHttpsUrl(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && !uri.getHost().trim().isEmpty()
                    && uri.getUserInfo() == null
                    && uri.getFragment() == null;
        } catch (Exception error) {
            return false;
        }
    }

    private String normalize(String value) {
        return value.replaceFirst("/+$", "");
    }

    private String appendPath(String path, String child) {
        String clean = (path == null || path.isEmpty()) ? "" : path;
        if (clean.endsWith("/")) {
            return clean + child;
        }
        return clean + "/" + child;
    }

    private void setBusy(boolean busy, String message) {
        connect.setEnabled(!busy);
        clear.setEnabled(!busy);
        serverInput.setEnabled(!busy);
        progress.setVisibility(busy ? View.VISIBLE : View.GONE);
        if (message != null) {
            status.setText(message);
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.getVisibility() == View.VISIBLE && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        networkExecutor.shutdownNow();
        if (web != null) {
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }

    private static final class HealthResult {
        private final boolean ok;
        private final String message;

        private HealthResult(boolean ok, String message) {
            this.ok = ok;
            this.message = message;
        }

        static HealthResult ok() {
            return new HealthResult(true, "Runtime در دسترس است.");
        }

        static HealthResult fail(String message) {
            return new HealthResult(false, message);
        }
    }
}
