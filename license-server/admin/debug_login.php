<?php
// ===== DATEI: admin/debug_login.php =====
// Diese Datei hilft beim Identifizieren des Login-Problems

echo "<!DOCTYPE html><html><head><title>🔧 Login Debug</title>";
echo "<style>body{font-family:Arial;max-width:800px;margin:20px auto;padding:20px;background:#121212;color:#caf1cd;line-height:1.6;} .ok{color:#83de8f;font-weight:bold;} .error{color:#ef4444;font-weight:bold;} .info{background:#323832;padding:15px;border-radius:8px;margin:10px 0;} .hash{background:#3f3f3f;padding:10px;border-radius:5px;font-family:monospace;word-break:break-all;} button{background:#83de8f;color:#000;padding:8px 16px;border:none;border-radius:5px;cursor:pointer;margin:5px;} input{background:#3f3f3f;border:1px solid #575757;color:#caf1cd;padding:8px;margin:5px;border-radius:3px;}</style></head><body>";

echo "<h1>🔧 Login Debug Tool</h1>";

// 1. Passwort-Hash generieren
echo "<h2>1. 🔐 Korrekten Hash generieren</h2>";
$correct_password = 'cyb3r9ffe4e761F!';
$correct_hash = password_hash($correct_password, PASSWORD_DEFAULT);

echo "<div class='info'>";
echo "<strong>Dein Passwort:</strong> <code>$correct_password</code><br>";
echo "<strong>Generierter Hash:</strong><br>";
echo "<div class='hash'>$correct_hash</div>";
echo "</div>";

// 2. auth.php prüfen
echo "<h2>2. 📁 auth.php Status</h2>";
if (file_exists('auth.php')) {
    echo "<span class='ok'>✅ auth.php existiert</span><br>";
    
    // Auth.php laden und prüfen
    ob_start();
    include 'auth.php';
    $output = ob_get_clean();
    
    if (isset($admin_users)) {
        echo "<span class='ok'>✅ \$admin_users Array gefunden</span><br>";
        echo "<strong>Gefundene Users:</strong><br>";
        foreach ($admin_users as $username => $hash) {
            echo "- <strong>$username:</strong> " . substr($hash, 0, 30) . "...<br>";
        }
    } else {
        echo "<span class='error'>❌ \$admin_users Array NICHT gefunden</span><br>";
    }
} else {
    echo "<span class='error'>❌ auth.php NICHT gefunden</span><br>";
}

// 3. Login-Test
echo "<h2>3. 🧪 Login-Test</h2>";
if (isset($_POST['test_login'])) {
    $test_user = $_POST['username'] ?? '';
    $test_pass = $_POST['password'] ?? '';
    
    echo "<div class='info'>";
    echo "<strong>Test-Eingabe:</strong><br>";
    echo "Username: <code>" . htmlspecialchars($test_user) . "</code><br>";
    echo "Password: <code>" . htmlspecialchars($test_pass) . "</code><br><br>";
    
    if (isset($admin_users) && isset($admin_users[$test_user])) {
        $stored_hash = $admin_users[$test_user];
        echo "<strong>Gespeicherter Hash:</strong><br>";
        echo "<div class='hash'>$stored_hash</div>";
        
        // Hash-Verifikation
        if (password_verify($test_pass, $stored_hash)) {
            echo "<span class='ok'>✅ PASSWORT KORREKT!</span><br>";
        } else {
            echo "<span class='error'>❌ PASSWORT FALSCH!</span><br>";
            
            // Debug: Neuen Hash testen
            $debug_hash = password_hash($test_pass, PASSWORD_DEFAULT);
            echo "<strong>Neuer Hash für dein Passwort:</strong><br>";
            echo "<div class='hash'>$debug_hash</div>";
        }
    } else {
        echo "<span class='error'>❌ USERNAME '$test_user' NICHT GEFUNDEN!</span><br>";
        if (isset($admin_users)) {
            echo "<strong>Verfügbare Usernames:</strong> " . implode(', ', array_keys($admin_users)) . "<br>";
        }
    }
    echo "</div>";
}

// Login-Test Formular
echo "<div class='info'>";
echo "<h3>🔍 Test-Login:</h3>";
echo "<form method='post'>";
echo "<input type='text' name='username' placeholder='Username' value='cyb3rgh05t'><br>";
echo "<input type='password' name='password' placeholder='Passwort' value='cyb3r9ffe4e761F!'><br>";
echo "<button type='submit' name='test_login'>🧪 Login testen</button>";
echo "</form>";
echo "</div>";

// 4. Session-Test
echo "<h2>4. 🍪 Session-Status</h2>";
session_start();
echo "<div class='info'>";
if (session_status() === PHP_SESSION_ACTIVE) {
    echo "<span class='ok'>✅ Sessions funktionieren</span><br>";
    echo "<strong>Session ID:</strong> " . session_id() . "<br>";
} else {
    echo "<span class='error'>❌ Sessions funktionieren NICHT</span><br>";
}
echo "</div>";

// 5. Datei-Permissions
echo "<h2>5. 📂 Datei-Berechtigungen</h2>";
$files = ['auth.php', 'login.php', 'logout.php', '../config/database.php'];
foreach ($files as $file) {
    if (file_exists($file)) {
        $perms = substr(sprintf('%o', fileperms($file)), -4);
        echo "<span class='ok'>✅ $file ($perms)</span><br>";
    } else {
        echo "<span class='error'>❌ $file fehlt</span><br>";
    }
}

// 6. Korrekte auth.php generieren
echo "<h2>6. ⚡ Korrigierte auth.php generieren</h2>";
echo "<div class='info'>";
echo "<p>Kopiere diesen Code in deine <strong>admin/auth.php</strong>:</p>";
echo "<textarea style='width:100%;height:200px;background:#1a1a1a;color:#caf1cd;padding:10px;font-family:monospace;border:1px solid #575757;'>";
echo htmlspecialchars("<?php
session_start();

// Admin-Zugangsdaten
\$admin_users = [
    'cyb3rgh05t' => '$correct_hash'
];

function isLoggedIn() {
    return isset(\$_SESSION['admin_logged_in']) && \$_SESSION['admin_logged_in'] === true;
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: login.php?redirect=' . urlencode(\$_SERVER['REQUEST_URI']));
        exit;
    }
}

function login(\$username, \$password) {
    global \$admin_users;
    
    if (isset(\$admin_users[\$username]) && password_verify(\$password, \$admin_users[\$username])) {
        \$_SESSION['admin_logged_in'] = true;
        \$_SESSION['admin_username'] = \$username;
        \$_SESSION['admin_login_time'] = time();
        
        // Log successful login
        if (function_exists('logActivity')) {
            logActivity('admin_login', [
                'username' => \$username,
                'ip' => \$_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]);
        }
        
        return true;
    }
    
    return false;
}

function logout() {
    if (function_exists('logActivity') && isset(\$_SESSION['admin_username'])) {
        logActivity('admin_logout', [
            'username' => \$_SESSION['admin_username'],
            'session_duration' => time() - (\$_SESSION['admin_login_time'] ?? time())
        ]);
    }
    
    session_destroy();
    header('Location: login.php?logged_out=1');
    exit;
}

function getAdminUsername() {
    return \$_SESSION['admin_username'] ?? 'Unbekannt';
}

function getSessionDuration() {
    \$login_time = \$_SESSION['admin_login_time'] ?? time();
    \$duration = time() - \$login_time;
    
    if (\$duration < 60) return \$duration . 's';
    if (\$duration < 3600) return floor(\$duration / 60) . 'min';
    return floor(\$duration / 3600) . 'h ' . floor((\$duration % 3600) / 60) . 'min';
}

// Session-Timeout (8 Stunden)
if (isLoggedIn() && isset(\$_SESSION['admin_login_time'])) {
    if (time() - \$_SESSION['admin_login_time'] > 28800) {
        logout();
    }
}
?>");
echo "</textarea>";
echo "</div>";

echo "<h2>🚀 Nächste Schritte:</h2>";
echo "<div class='info'>";
echo "<ol>";
echo "<li><strong>auth.php überschreiben</strong> mit dem Code oben</li>";
echo "<li><strong>Login testen</strong> mit cyb3rgh05t / cyb3r9ffe4e761F!</li>";
echo "<li><strong>Diese debug_login.php löschen</strong> (Sicherheitsrisiko)</li>";
echo "</ol>";
echo "</div>";

echo "<p><strong>💡 Tipp:</strong> Nach dem Fix die login.php aufrufen und mit den Daten anmelden!</p>";
echo "</body></html>";
?>