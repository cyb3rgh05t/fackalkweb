<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔧 Datenbank-Problem lösen</h1>";
echo "<style>body{font-family:Arial;margin:20px;line-height:1.6;} .ok{color:green;font-weight:bold;} .error{color:red;font-weight:bold;} .warning{color:orange;font-weight:bold;} .code{background:#f8f9fa;padding:10px;border-radius:5px;margin:10px 0;}</style>";

// Deine Zugangsdaten (vom Debug-Script)
$host = 'localhost';
$username = 'kfz_licenses';
$password = 'kfz_licenses';
$dbname = 'kfz_licenses';

echo "<h2>📋 Deine Zugangsdaten:</h2>";
echo "Host: <code>$host</code><br>";
echo "Username: <code>$username</code><br>";
echo "Password: <code>" . str_repeat('*', strlen($password)) . "</code><br>";
echo "Database: <code>$dbname</code><br><br>";

// Schritt 1: Grundverbindung testen (ohne Datenbank)
echo "<h2>🔍 Schritt 1: MySQL-Verbindung testen</h2>";
try {
    $pdo_test = new PDO("mysql:host=$host;charset=utf8mb4", $username, $password);
    $pdo_test->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "<span class='ok'>✅ MySQL-Verbindung erfolgreich!</span><br>";
    
    // MySQL-Version anzeigen
    $version = $pdo_test->query('SELECT VERSION()')->fetchColumn();
    echo "MySQL Version: <code>$version</code><br>";
    
} catch (PDOException $e) {
    echo "<span class='error'>❌ MySQL-Verbindung fehlgeschlagen!</span><br>";
    echo "Fehler: " . $e->getMessage() . "<br>";
    echo "<div class='code'>";
    echo "<strong>Mögliche Lösungen:</strong><br>";
    echo "1. Host-Adresse prüfen (manchmal nicht 'localhost')<br>";
    echo "2. Benutzername/Passwort im Hosting-Panel prüfen<br>";
    echo "3. MySQL-Service läuft?<br>";
    echo "4. Firewall-Einstellungen prüfen<br>";
    echo "</div>";
    die();
}

// Schritt 2: Prüfen ob Datenbank existiert
echo "<h2>🗄️ Schritt 2: Datenbank prüfen/erstellen</h2>";
try {
    // Liste aller Datenbanken abrufen
    $stmt = $pdo_test->query("SHOW DATABASES");
    $databases = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "Verfügbare Datenbanken:<br>";
    foreach ($databases as $db) {
        echo "- <code>$db</code>";
        if ($db === $dbname) {
            echo " <span class='ok'>← GEFUNDEN!</span>";
        }
        echo "<br>";
    }
    
    if (!in_array($dbname, $databases)) {
        echo "<br><span class='warning'>⚠️ Datenbank '$dbname' existiert nicht. Erstelle sie...</span><br>";
        
        // Datenbank erstellen
        $pdo_test->exec("CREATE DATABASE `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        echo "<span class='ok'>✅ Datenbank '$dbname' erfolgreich erstellt!</span><br>";
    } else {
        echo "<br><span class='ok'>✅ Datenbank '$dbname' existiert bereits!</span><br>";
    }
    
} catch (PDOException $e) {
    echo "<span class='error'>❌ Fehler beim Erstellen der Datenbank:</span><br>";
    echo $e->getMessage() . "<br>";
    
    // Alternative Lösung anbieten
    echo "<div class='code'>";
    echo "<strong>📝 Manuelle Lösung:</strong><br>";
    echo "1. Gehe zu deinem Hosting-Panel (cPanel, Plesk, etc.)<br>";
    echo "2. Öffne 'MySQL-Datenbanken' oder 'phpMyAdmin'<br>";
    echo "3. Erstelle neue Datenbank: <strong>$dbname</strong><br>";
    echo "4. Lade diese Seite neu<br>";
    echo "</div>";
}

// Schritt 3: Verbindung zur Datenbank testen
echo "<h2>🔗 Schritt 3: Verbindung zur Datenbank testen</h2>";
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    
    echo "<span class='ok'>✅ Verbindung zur Datenbank '$dbname' erfolgreich!</span><br>";
    
} catch (PDOException $e) {
    echo "<span class='error'>❌ Verbindung zur Datenbank fehlgeschlagen:</span><br>";
    echo $e->getMessage() . "<br>";
    die();
}

// Schritt 4: Tabellen erstellen
echo "<h2>📊 Schritt 4: Tabellen erstellen</h2>";
$tables_sql = [
    "customers" => "CREATE TABLE IF NOT EXISTS customers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        company VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )",
    
    "licenses" => "CREATE TABLE IF NOT EXISTS licenses (
        id INT PRIMARY KEY AUTO_INCREMENT,
        license_key VARCHAR(50) UNIQUE NOT NULL,
        customer_id INT NOT NULL,
        license_type ENUM('basic', 'professional', 'enterprise') DEFAULT 'basic',
        max_activations INT DEFAULT 1,
        status ENUM('active', 'suspended', 'expired') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        notes TEXT,
        price DECIMAL(10,2) DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'EUR',
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )",
    
    "license_activations" => "CREATE TABLE IF NOT EXISTS license_activations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        license_key VARCHAR(50) NOT NULL,
        hardware_id VARCHAR(64) NOT NULL,
        first_activation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_validation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deactivated_at TIMESTAMP NULL,
        status ENUM('active', 'deactivated') DEFAULT 'active',
        app_version VARCHAR(20),
        validation_count INT DEFAULT 1,
        last_ip VARCHAR(45),
        device_info JSON,
        UNIQUE KEY unique_activation (license_key, hardware_id),
        FOREIGN KEY (license_key) REFERENCES licenses(license_key) ON DELETE CASCADE
    )",
    
    "license_features" => "CREATE TABLE IF NOT EXISTS license_features (
        id INT PRIMARY KEY AUTO_INCREMENT,
        license_key VARCHAR(50) NOT NULL,
        feature_name VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (license_key) REFERENCES licenses(license_key) ON DELETE CASCADE,
        UNIQUE KEY unique_feature (license_key, feature_name)
    )",
    
    "activity_log" => "CREATE TABLE IF NOT EXISTS activity_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        action VARCHAR(100) NOT NULL,
        details JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )"
];

foreach ($tables_sql as $table_name => $sql) {
    try {
        $pdo->exec($sql);
        echo "✅ Tabelle <code>$table_name</code> erstellt/überprüft<br>";
    } catch (PDOException $e) {
        echo "<span class='error'>❌ Fehler bei Tabelle $table_name:</span> " . $e->getMessage() . "<br>";
    }
}

// Schritt 5: Test-Daten einfügen
echo "<h2>🧪 Schritt 5: Test-Daten einfügen</h2>";
try {
    // Prüfen ob bereits Daten vorhanden
    $stmt = $pdo->query("SELECT COUNT(*) FROM customers");
    $customer_count = $stmt->fetchColumn();
    
    if ($customer_count == 0) {
        echo "Füge Test-Daten ein...<br>";
        
        // Test-Kunden
        $stmt = $pdo->prepare("INSERT INTO customers (name, email, company) VALUES (?, ?, ?)");
        $customers = [
            ['Max Mustermann', 'max@musterfirma.de', 'Musterfirma GmbH'],
            ['Anna Schmidt', 'anna@schmidt-kfz.de', 'Schmidt KFZ-Werkstatt'],
            ['Test Kunde', 'test@example.com', 'Test Firma']
        ];
        
        foreach ($customers as $customer) {
            $stmt->execute($customer);
        }
        echo "✅ Test-Kunden erstellt<br>";
        
        // Test-Lizenzen
        $stmt = $pdo->prepare("INSERT INTO licenses (license_key, customer_id, license_type, max_activations, expires_at, price) VALUES (?, ?, ?, ?, ?, ?)");
        $licenses = [
            ['DEMO1-23456-ABCDE-78901', 1, 'professional', 2, '2025-12-31 23:59:59', 299.00],
            ['DEMO2-34567-BCDEF-89012', 2, 'basic', 1, '2025-06-30 23:59:59', 149.00],
            ['DEMO3-45678-CDEFG-90123', 3, 'enterprise', 5, '2026-01-31 23:59:59', 599.00]
        ];
        
        foreach ($licenses as $license) {
            $stmt->execute($license);
        }
        echo "✅ Test-Lizenzen erstellt<br>";
        
        // Test-Features
        $stmt = $pdo->prepare("INSERT INTO license_features (license_key, feature_name) VALUES (?, ?)");
        $features = [
            ['DEMO1-23456-ABCDE-78901', 'basic'],
            ['DEMO1-23456-ABCDE-78901', 'backup'],
            ['DEMO1-23456-ABCDE-78901', 'export'],
            ['DEMO2-34567-BCDEF-89012', 'basic'],
            ['DEMO3-45678-CDEFG-90123', 'basic'],
            ['DEMO3-45678-CDEFG-90123', 'backup'],
            ['DEMO3-45678-CDEFG-90123', 'export'],
            ['DEMO3-45678-CDEFG-90123', 'premium']
        ];
        
        foreach ($features as $feature) {
            $stmt->execute($feature);
        }
        echo "✅ Test-Features erstellt<br>";
        
    } else {
        echo "<span class='ok'>✅ Daten bereits vorhanden ($customer_count Kunden)</span><br>";
    }
    
} catch (PDOException $e) {
    echo "<span class='error'>❌ Fehler beim Erstellen der Test-Daten:</span> " . $e->getMessage() . "<br>";
}

// Schritt 6: config/database.php erstellen
echo "<h2>⚙️ Schritt 6: Konfigurationsdatei erstellen</h2>";
$config_content = "<?php
\$host = '$host';
\$dbname = '$dbname';
\$username = '$username';
\$password = '$password';

try {
    \$pdo = new PDO(\"mysql:host=\$host;dbname=\$dbname;charset=utf8mb4\", \$username, \$password);
    \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    \$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException \$e) {
    die(json_encode(['error' => 'Database connection failed: ' . \$e->getMessage()]));
}

function logActivity(\$action, \$details = []) {
    global \$pdo;
    try {
        \$stmt = \$pdo->prepare(\"
            INSERT INTO activity_log (action, details, ip_address, user_agent, created_at) 
            VALUES (?, ?, ?, ?, NOW())
        \");
        \$stmt->execute([
            \$action,
            json_encode(\$details),
            \$_SERVER['REMOTE_ADDR'] ?? 'unknown',
            \$_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ]);
    } catch (Exception \$e) {
        error_log(\"Logging failed: \" . \$e->getMessage());
    }
}
?>";

if (!is_dir('config')) {
    mkdir('config', 0755, true);
    echo "✅ Ordner 'config' erstellt<br>";
}

file_put_contents('config/database.php', $config_content);
echo "✅ Datei 'config/database.php' erstellt<br>";

// Schritt 7: Finaler Test
echo "<h2>🎯 Schritt 7: Finaler Test</h2>";
try {
    // Test-Abfrage
    $stmt = $pdo->query("
        SELECT l.license_key, c.name, l.license_type, l.max_activations
        FROM licenses l 
        JOIN customers c ON l.customer_id = c.id 
        LIMIT 3
    ");
    $test_licenses = $stmt->fetchAll();
    
    echo "<strong>✅ Alles funktioniert! Gefundene Test-Lizenzen:</strong><br>";
    foreach ($test_licenses as $license) {
        echo "🔑 <code>{$license['license_key']}</code> - {$license['name']} ({$license['license_type']})<br>";
    }
    
} catch (PDOException $e) {
    echo "<span class='error'>❌ Finaler Test fehlgeschlagen:</span> " . $e->getMessage() . "<br>";
}

echo "<hr>";
echo "<h2>🎉 Setup abgeschlossen!</h2>";
echo "<div class='code'>";
echo "<strong>✅ Was jetzt funktioniert:</strong><br>";
echo "• Datenbank: $dbname<br>";
echo "• Alle Tabellen erstellt<br>";
echo "• Test-Daten eingefügt<br>";
echo "• config/database.php erstellt<br>";
echo "<br>";
echo "<strong>🔑 Test-Lizenzschlüssel:</strong><br>";
echo "• DEMO1-23456-ABCDE-78901 (Professional, 2 PCs)<br>";
echo "• DEMO2-34567-BCDEF-89012 (Basic, 1 PC)<br>";
echo "• DEMO3-45678-CDEFG-90123 (Enterprise, 5 PCs)<br>";
echo "</div>";

$base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);

echo "<h2>🚀 Nächste Schritte:</h2>";
echo "1. <a href='{$base_url}/admin/index.php' target='_blank' style='background:#28a745;color:white;padding:8px 16px;text-decoration:none;border-radius:4px;'>🎯 Admin-Interface öffnen</a><br><br>";
echo "2. <strong>API testen:</strong><br>";
echo "<div class='code'>";
echo "curl -X POST {$base_url}/api/validate.php \\<br>";
echo "&nbsp;&nbsp;-H \"Content-Type: application/json\" \\<br>";
echo "&nbsp;&nbsp;-d '{\"license_key\":\"DEMO1-23456-ABCDE-78901\",\"hardware_id\":\"test123\"}'";
echo "</div>";
echo "3. <strong>In deiner App testen:</strong> Server-URL auf <code>{$base_url}/api</code> setzen<br>";
echo "4. <strong>Test-Lizenz in App eingeben:</strong> <code>DEMO1-23456-ABCDE-78901</code><br>";

?>

// ===== ZUSÄTZLICH: EINFACHER API-TEST =====
// test_api.php

<?php
// Einfacher API-Test ohne Frontend

header('Content-Type: text/html; charset=utf-8');
echo "<h1>🔧 API-Test</h1>";
echo "<style>body{font-family:Arial;margin:20px;} .ok{color:green;} .error{color:red;} pre{background:#f8f9fa;padding:15px;border-radius:5px;}</style>";

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['test_api'])) {
    
    $license_key = $_POST['license_key'] ?? 'DEMO1-23456-ABCDE-78901';
    $hardware_id = $_POST['hardware_id'] ?? 'test123';
    
    // API-Call simulieren
    $api_url = 'api/validate.php';
    $data = json_encode([
        'license_key' => $license_key,
        'hardware_id' => $hardware_id,
        'app_version' => '2.0',
        'timestamp' => time()
    ]);
    
    echo "<h2>📤 API-Request:</h2>";
    echo "<strong>URL:</strong> $api_url<br>";
    echo "<strong>Method:</strong> POST<br>";
    echo "<strong>Data:</strong><br>";
    echo "<pre>" . $data . "</pre>";
    
    // cURL-Request ausführen
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    echo "<h2>📥 API-Response:</h2>";
    echo "<strong>HTTP Code:</strong> $http_code<br>";
    
    if ($error) {
        echo "<span class='error'>❌ cURL Error: $error</span><br>";
    } else {
        echo "<strong>Response:</strong><br>";
        echo "<pre>" . $response . "</pre>";
        
        $json = json_decode($response, true);
        if ($json) {
            if (isset($json['valid']) && $json['valid']) {
                echo "<span class='ok'>✅ API funktioniert! Lizenz gültig.</span><br>";
            } else {
                echo "<span class='error'>❌ Lizenz ungültig: " . ($json['error'] ?? 'Unbekannter Fehler') . "</span><br>";
            }
        }
    }
    
    echo "<hr>";
}

echo "<h2>🧪 API-Test ausführen:</h2>";
echo "<form method='post'>";
echo "<p>Lizenzschlüssel: <input type='text' name='license_key' value='DEMO1-23456-ABCDE-78901' style='width:300px;'></p>";
echo "<p>Hardware-ID: <input type='text' name='hardware_id' value='test123' style='width:300px;'></p>";
echo "<button type='submit' name='test_api' style='background:#007bff;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;'>🚀 API testen</button>";
echo "</form>";

echo "<h2>💡 Alternative Tests:</h2>";
echo "<strong>1. Browser-Test (sollte 405 Error geben - das ist korrekt!):</strong><br>";
echo "<a href='api/validate.php' target='_blank'>api/validate.php</a><br><br>";

echo "<strong>2. Command-Line Test:</strong><br>";
$base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);
echo "<pre>curl -X POST {$base_url}/api/validate.php \\
  -H \"Content-Type: application/json\" \\
  -d '{\"license_key\":\"DEMO1-23456-ABCDE-78901\",\"hardware_id\":\"test123\"}'</pre>";