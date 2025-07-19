<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔧 Lizenz-Server Debug</h1>";
echo "<style>body{font-family:Arial;margin:20px;} .ok{color:green;} .error{color:red;} .warning{color:orange;}</style>";

// 1. PHP-Version prüfen
echo "<h2>📋 PHP-Information</h2>";
echo "PHP Version: " . phpversion() . "<br>";
echo "PDO verfügbar: " . (extension_loaded('pdo') ? '<span class="ok">✅ Ja</span>' : '<span class="error">❌ Nein</span>') . "<br>";
echo "PDO MySQL verfügbar: " . (extension_loaded('pdo_mysql') ? '<span class="ok">✅ Ja</span>' : '<span class="error">❌ Nein</span>') . "<br>";

// 2. Datei-Struktur prüfen
echo "<h2>📁 Datei-Struktur</h2>";
$files = [
    'config/database.php',
    'api/validate.php', 
    'api/deactivate.php',
    'admin/index.php',
    'admin/create_license.php',
    'admin/admin_actions.php'
];

foreach ($files as $file) {
    if (file_exists($file)) {
        echo "✅ $file vorhanden<br>";
    } else {
        echo "<span class='error'>❌ $file fehlt</span><br>";
    }
}

// 3. Datenbankverbindung testen
echo "<h2>🗄️ Datenbank-Verbindung</h2>";

if (file_exists('config/database.php')) {
    try {
        // Deine database.php laden
        ob_start();
        include 'config/database.php';
        $output = ob_get_clean();
        
        if (isset($pdo)) {
            echo "<span class='ok'>✅ Datenbankverbindung erfolgreich</span><br>";
            
            // Tabellen prüfen
            $tables = ['customers', 'licenses', 'license_activations', 'license_features', 'activity_log'];
            foreach ($tables as $table) {
                try {
                    $stmt = $pdo->query("SELECT COUNT(*) FROM $table");
                    $count = $stmt->fetchColumn();
                    echo "✅ Tabelle $table: $count Einträge<br>";
                } catch (Exception $e) {
                    echo "<span class='error'>❌ Tabelle $table: " . $e->getMessage() . "</span><br>";
                }
            }
        } else {
            echo "<span class='error'>❌ Datenbankverbindung fehlgeschlagen</span><br>";
            if ($output) {
                echo "Fehler: " . htmlspecialchars($output) . "<br>";
            }
        }
    } catch (Exception $e) {
        echo "<span class='error'>❌ Datenbankverbindung fehlgeschlagen: " . $e->getMessage() . "</span><br>";
    }
} else {
    echo "<span class='error'>❌ config/database.php nicht gefunden</span><br>";
}

// 4. API-Test
echo "<h2>🔗 API-Test</h2>";
if (file_exists('api/validate.php')) {
    echo "✅ validate.php gefunden<br>";
    echo "📝 Test mit: <code>curl -X POST " . getCurrentUrl() . "/api/validate.php -H 'Content-Type: application/json' -d '{\"license_key\":\"TEST\",\"hardware_id\":\"123\"}'</code><br>";
} else {
    echo "<span class='error'>❌ api/validate.php nicht gefunden</span><br>";
}

// 5. Test-Daten erstellen Button
echo "<h2>🧪 Test-Daten</h2>";
if (isset($_GET['create_test_data'])) {
    createTestData();
}
echo "<a href='?create_test_data=1' style='background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;'>🎯 Test-Daten erstellen</a><br><br>";

// 6. Berechtigungen prüfen
echo "<h2>🔒 Berechtigungen</h2>";
$dirs = ['config', 'api', 'admin'];
foreach ($dirs as $dir) {
    if (is_dir($dir)) {
        $perms = substr(sprintf('%o', fileperms($dir)), -4);
        echo "📁 $dir: $perms " . (is_writable($dir) ? '<span class="ok">✅ Beschreibbar</span>' : '<span class="warning">⚠️ Nicht beschreibbar</span>') . "<br>";
    }
}

function getCurrentUrl() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['REQUEST_URI']);
    return $protocol . $host . $path;
}

function createTestData() {
    global $pdo;
    
    if (!isset($pdo)) {
        echo "<span class='error'>❌ Keine Datenbankverbindung</span><br>";
        return;
    }
    
    try {
        // Test-Kunden erstellen
        $stmt = $pdo->prepare("INSERT IGNORE INTO customers (name, email, company) VALUES (?, ?, ?)");
        $stmt->execute(['Max Mustermann', 'max@musterfirma.de', 'Musterfirma GmbH']);
        $stmt->execute(['Anna Schmidt', 'anna@schmidt-kfz.de', 'Schmidt KFZ-Werkstatt']);
        $stmt->execute(['Peter Weber', 'peter@weber-lackierung.de', 'Weber Lackierung']);
        
        // Test-Lizenzen erstellen
        $stmt = $pdo->prepare("INSERT IGNORE INTO licenses (license_key, customer_id, license_type, max_activations, expires_at, price) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute(['DEMO1-23456-ABCDE-78901', 1, 'professional', 2, '2025-12-31 23:59:59', 299.00]);
        $stmt->execute(['DEMO2-34567-BCDEF-89012', 2, 'basic', 1, '2025-06-30 23:59:59', 149.00]);
        $stmt->execute(['DEMO3-45678-CDEFG-90123', 3, 'enterprise', 5, '2026-01-31 23:59:59', 599.00]);
        
        // Test-Features erstellen
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
        
        $stmt = $pdo->prepare("INSERT IGNORE INTO license_features (license_key, feature_name) VALUES (?, ?)");
        foreach ($features as $feature) {
            $stmt->execute($feature);
        }
        
        echo "<span class='ok'>✅ Test-Daten erfolgreich erstellt!</span><br>";
        echo "📋 3 Kunden, 3 Lizenzen und Features erstellt<br>";
        echo "🔑 Test-Lizenz: DEMO1-23456-ABCDE-78901<br>";
        
    } catch (Exception $e) {
        echo "<span class='error'>❌ Fehler beim Erstellen der Test-Daten: " . $e->getMessage() . "</span><br>";
    }
}

echo "<hr>";
echo "<h2>📞 Nächste Schritte</h2>";
echo "1. ✅ Alle grünen Häkchen? → Admin-Interface sollte funktionieren<br>";
echo "2. ❌ Rote X? → Probleme zuerst lösen<br>";
echo "3. 🧪 Test-Daten erstellt? → Admin-Interface neu laden<br>";
echo "4. 🔗 API-Test mit curl ausführen<br>";

?>