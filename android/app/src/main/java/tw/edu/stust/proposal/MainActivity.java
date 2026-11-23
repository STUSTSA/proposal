package tw.edu.stust.proposal;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;
import java.util.regex.Pattern;

/**
 * 企劃書產生器的安卓外殼。
 * - 網站檔案打包在 APK 的 assets/www，用 WebViewAssetLoader 以 https://appassets.androidplatform.net/ 提供：沒網路也能填寫與匯出。
 * - 匯出的 Word／PDF：網頁呼叫 ProposalApp.saveFile(檔名, 類型, base64)，存到「下載」資料夾（Android 10 以上），舊版手機讓使用者選位置。
 * - 網頁裡的 <input type=file>（匯入 Word、選圖片）交給系統的檔案選擇器。
 * - 其他網址（學校連結等）一律交給瀏覽器。
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String HOME = "https://" + HOST + "/assets/www/index.html";
    private static final Pattern RGB = Pattern.compile("^rgba?\\(\\s*(\\d{1,3})\\s*[, ]\\s*(\\d{1,3})\\s*[, ]\\s*(\\d{1,3}).*\\)$");
    private static final int REQ_FILE = 1, REQ_SAVE = 2;

    private FrameLayout root;
    private WebView web;
    private WebViewAssetLoader loader;
    private String insetCss = "";
    private ValueCallback<Uri[]> fileCb;
    private byte[] pendingBytes;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);

        root = new FrameLayout(this);
        root.setOnApplyWindowInsetsListener((v, ins) -> {
            int t, r, l, nav, kb;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets sys = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                int ime = ins.getInsets(WindowInsets.Type.ime()).bottom;
                t = sys.top; l = sys.left; r = sys.right; nav = sys.bottom;
                kb = ime > nav ? ime : 0;
            } else {
                t = ins.getSystemWindowInsetTop(); l = ins.getSystemWindowInsetLeft(); r = ins.getSystemWindowInsetRight();
                nav = ins.getStableInsetBottom();
                kb = ins.getSystemWindowInsetBottom() > nav ? ins.getSystemWindowInsetBottom() : 0;
            }
            /* 內容滿版延伸到系統列底下；鍵盤出現時才把底部縮上去，避免擋住輸入框 */
            v.setPadding(0, 0, 0, kb);
            float d = getResources().getDisplayMetrics().density;
            insetCss = "var e=document.documentElement.style;e.setProperty('--sa-top','" + (t / d) + "px');e.setProperty('--sa-left','" + (l / d)
                    + "px');e.setProperty('--sa-right','" + (r / d) + "px');e.setProperty('--sa-bottom','" + (kb > 0 ? 0 : nav / d) + "px');";
            pushInsets();
            return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : ins.consumeSystemWindowInsets();
        });

        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        setBarColor(defaultColor());

        loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);   /* 版面用固定 px 排，不跟系統字型大小放大 */
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.addJavascriptInterface(new Bridge(), "ProposalApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }

            @Override
            public void onPageCommitVisible(WebView v, String url) { pushInsets(); }

            @Override
            public void onPageFinished(WebView v, String url) {
                pushInsets();
                v.evaluateJavascript("(function(){if(window.__tcObs)return;window.__tcObs=1;"
                        + "function s(){var m=document.querySelector('meta[name=\"theme-color\"]');if(m&&window.ProposalApp)ProposalApp.themeColor(m.content)}"
                        + "s();new MutationObserver(s).observe(document.head,{subtree:true,attributes:true,attributeFilter:['content']})})()", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(p.createIntent(), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCb = null;
                    toast("找不到可以選檔案的 App");
                    return false;
                }
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        /* 先讓網頁處理（關掉放大預覽、回上一步），網頁沒處理才離開 App */
        web.evaluateJavascript("(function(){return window.__appBack?!!window.__appBack():false})()", res -> {
            if (!"true".equals(res)) {
                if (web.canGoBack()) web.goBack(); else finish();
            }
        });
    }

    @Override
    protected void onActivityResult(int req, int code, Intent data) {
        super.onActivityResult(req, code, data);
        if (req == REQ_FILE) {
            if (fileCb != null) fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(code, data));
            fileCb = null;
        } else if (req == REQ_SAVE) {
            byte[] b = pendingBytes;
            pendingBytes = null;
            if (code != RESULT_OK || data == null || data.getData() == null || b == null) { toast("沒有儲存"); return; }
            try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
                os.write(b);
                toast("已儲存");
            } catch (Exception e) {
                toast("儲存失敗：" + e.getMessage());
            }
        }
    }

    private void toast(String m) { runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_LONG).show()); }

    private int defaultColor() {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        return night ? 0xFF000000 : 0xFFF5F0E1;
    }

    private void setBarColor(int c) {
        root.setBackgroundColor(c);
        getWindow().setBackgroundDrawable(new ColorDrawable(c));
        boolean light = (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)) / 255 > 0.5;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController ic = getWindow().getInsetsController();
            if (ic != null) {
                int m = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                ic.setSystemBarsAppearance(light ? m : 0, m);
            }
        } else {
            View d = getWindow().getDecorView();
            int f = d.getSystemUiVisibility();
            int m = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
            d.setSystemUiVisibility(light ? (f | m) : (f & ~m));
        }
    }

    /** 把系統列高度寫成網頁的 CSS 變數（css/app.css 的 --sa-*） */
    private void pushInsets() {
        if (web != null && !insetCss.isEmpty()) web.evaluateJavascript("(function(){" + insetCss + "})()", null);
    }

    private void openExternal(Uri uri) {
        String sc = uri.getScheme();
        if (!"https".equals(sc) && !"http".equals(sc) && !"mailto".equals(sc) && !"tel".equals(sc)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
    }

    private static String safeName(String n) {
        String s = n == null ? "" : n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (s.isEmpty()) s = "企劃書";
        return s.length() > 120 ? s.substring(0, 120) : s;
    }

    /** Android 10 以上：存到「下載/企劃書」；回傳給網頁顯示的一句話 */
    private String saveToDownloads(String name, String mime, byte[] bytes) throws Exception {
        ContentValues cv = new ContentValues();
        cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
        cv.put(MediaStore.Downloads.MIME_TYPE, mime);
        cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/企劃書");
        cv.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
        if (uri == null) throw new Exception("無法建立檔案");
        try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(bytes); }
        cv.clear();
        cv.put(MediaStore.Downloads.IS_PENDING, 0);
        getContentResolver().update(uri, cv, null, null);
        final Uri done = uri;
        runOnUiThread(() -> {
            Intent open = new Intent(Intent.ACTION_VIEW).setDataAndType(done, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try { startActivity(Intent.createChooser(open, "開啟 " + name)); } catch (Exception ignored) { }
        });
        return "已存到手機的「下載/企劃書」資料夾";
    }

    private class Bridge {
        @JavascriptInterface
        public String saveFile(String name, String mime, String b64) {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                String n = safeName(name);
                String m = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
                if (Build.VERSION.SDK_INT >= 29) return saveToDownloads(n, m, bytes);
                pendingBytes = bytes;
                runOnUiThread(() -> {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(m).putExtra(Intent.EXTRA_TITLE, n);
                    try { startActivityForResult(i, REQ_SAVE); } catch (Exception e) { pendingBytes = null; toast("這支手機無法選擇儲存位置"); }
                });
                return "請選擇要儲存的位置";
            } catch (Exception e) {
                return "ERR:" + e.getMessage();
            }
        }

        @JavascriptInterface
        public void themeColor(String c) {
            final int col = parseColor(c);
            if (col != 0) runOnUiThread(() -> setBarColor(col));
        }
    }

    static int parseColor(String c) {
        if (c == null) return 0;
        c = c.trim();
        try {
            if (c.matches("^#[0-9a-fA-F]{3}$")) c = "#" + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3);
            if (c.matches("^#[0-9a-fA-F]{6}$")) return Color.parseColor(c);
            java.util.regex.Matcher m = RGB.matcher(c);
            if (m.matches()) return Color.rgb(Math.min(255, Integer.parseInt(m.group(1))), Math.min(255, Integer.parseInt(m.group(2))), Math.min(255, Integer.parseInt(m.group(3))));
        } catch (Exception ignored) { }
        return 0;
    }
}
