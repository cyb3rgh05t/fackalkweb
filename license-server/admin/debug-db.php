<?php
header('Content-Type: text/html; charset=utf-8');
require_once '../config/database.php';

echo "<h1>🔍 Datenbank Debug</h1>";
echo "<style>body{font-family:Arial;margin:20px;line-height:1.6;} .ok{color:green;font-weight:bold;} .error{color:red;font-weight:bold;} .warning{color:orange;font-weight:bold;} table{border-collapse:collapse;width:100%;margin:20px 0;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f2f2f2;} .code{background:#f8f9fa;padding:10px;border-radius:5px;margin:10px 0;} .license-key{font-family:monospace;background:#e9ecef;padding:4px 8px;border-radius:4px;}</style>";

// 1. Datenbankverbindung prüfen
echo "<h2>📊 Datenbankverbindung</h2>";
try {
    $test = $pdo->query("SELECT 1");
    echo "<span class='ok'>✅ Datenbankverbindung erfolgreich</span><br>";
} catch (Exception $e) {
    echo "<span class='error'>❌ Datenbankverbindung fehlgeschlagen: " . $e->getMessage() . "</span><br>";
    die();
}

// 2. Tabellen prüfen
echo "<h2>📋 Tabellen-Status</h2>";
$tables = ['customers', 'licenses', 'license_activations', 'license_features', 'activity_log'];

foreach ($tables as $table) {
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM $table");
        $count = $stmt->fetchColumn();
        echo "✅ <strong>$table:</strong> $count Einträge<br>";
    } catch (Exception $e) {
        echo "<span class='error'>❌ Tabelle $table: " . $e->getMessage() . "</span><br>";
    }
}

// 3. Alle Lizenzen anzeigen
echo "<h2>🔑 Alle Lizenzen in der Datenbank</h2>";
try {
    $stmt = $pdo->query("
        SELECT l.*, c.name as customer_name, c.email as customer_email
        FROM licenses l 
        LEFT JOIN customers c ON l.customer_id = c.id 
        ORDER BY l.created_at DESC
    ");
    $licenses = $stmt->fetchAll();
    
    if (empty($licenses)) {
        echo "<span class='warning'>⚠️ Keine Lizenzen in der Datenbank gefunden!</span><br>";
        echo "<div class='code'>";
        echo "<strong>Lösung:</strong><br>";
        echo "1. Gehe zu <a href='index.php'>Admin-Dashboard</a><br>";
        echo "2. Klicke auf 'Neue Lizenz erstellen'<br>";
        echo "3. Oder führe dieses SQL aus:<br>";
        echo "</div>";
        
        // SQL zum Erstellen einer Test-Lizenz
        echo "<div class='code'>";
        echo "<strong>Test-Lizenz SQL:</strong><br>";
        echo "<pre>";
        echo "INSERT INTO customers (name, email, company) VALUES ('Test Kunde', 'test@example.com', 'Test Firma');\n";
        echo "INSERT INTO licenses (license_key, customer_id, license_type, max_activations, expires_at, price) \n";
        echo "VALUES ('TEST-1234-5678-9012', 1, 'professional', 2, '2025-12-31 23:59:59', 299.00);\n";
        echo "INSERT INTO license_features (license_key, feature_name) VALUES \n";
        echo "('TEST-1234-5678-9012', 'basic'), ('TEST-1234-5678-9012', 'backup');";
        echo "</pre>";
        echo "</div>";
        
    } else {
        echo "<span class='ok'>✅ " . count($licenses) . " Lizenz(en) gefunden:</span><br><br>";
        
        echo "<table>";
        echo "<tr><th>Lizenzschlüssel</th><th>Kunde</th><th>Typ</th><th>Status</th><th>Erstellt</th><th>Ablauf</th><th>Test-Link</th></tr>";
        
        foreach ($licenses as $license) {
            $status_color = $license['status'] === 'active' ? 'green' : 'red';
            $expires_text = $license['expires_at'] ? date('d.m.Y', strtotime($license['expires_at'])) : 'Unbegrenzt';
            
            echo "<tr>";
            echo "<td><span class='license-key'>" . htmlspecialchars($license['license_key']) . "</span></td>";
            echo "<td>" . htmlspecialchars($license['customer_name'] ?: 'Unbekannt') . "</td>";
            echo "<td>" . htmlspecialchars($license['license_type']) . "</td>";
            echo "<td style='color:$status_color; font-weight:bold;'>" . htmlspecialchars($license['status']) . "</td>";
            echo "<td>" . date('d.m.Y H:i', strtotime($license['created_at'])) . "</td>";
            echo "<td>$expires_text</td>";
            echo "<td><a href='license_details.php?key=" . urlencode($license['license_key']) . "' target='_blank'>📊 Details</a></td>";
            echo "</tr>";
        }
        echo "</table>";
    }
    
} catch (Exception $e) {
    echo "<span class='error'>❌ Fehler beim Laden der Lizenzen: " . $e->getMessage() . "</span><br>";
}

// 4. Spezifische Lizenz testen
echo "<h2>🔍 Spezifische Lizenz testen</h2>";
$test_key = $_GET['key'] ?? 'KFZ5470-0180-5488-7011';

echo "<form method='get'>";
echo "<label>Lizenzschlüssel testen:</label><br>";
echo "<input type='text' name='key' value='" . htmlspecialchars($test_key) . "' style='width:300px;padding:8px;margin:10px 0;'><br>";
echo "<button type='submit' style='padding:8px 16px;'>🔍 Testen</button>";
echo "</form>";

if (isset($_GET['key'])) {
    echo "<h3>Test-Ergebnis für: <span class='license-key'>" . htmlspecialchars($test_key) . "</span></h3>";
    
    try {
        $stmt = $pdo->prepare("
            SELECT l.*, c.name as customer_name, c.email as customer_email 
            FROM licenses l 
            LEFT JOIN customers c ON l.customer_id = c.id 
            WHERE l.license_key = ?
        ");
        $stmt->execute([$test_key]);
        $license = $stmt->fetch();
        
        if ($license) {
            echo "<span class='ok'>✅ Lizenz gefunden!</span><br>";
            echo "<div class='code'>";
            echo "<strong>Details:</strong><br>";
            echo "Kunde: " . htmlspecialchars($license['customer_name']) . "<br>";
            echo "E-Mail: " . htmlspecialchars($license['customer_email']) . "<br>";
            echo "Typ: " . htmlspecialchars($license['license_type']) . "<br>";
            echo "Status: " . htmlspecialchars($license['status']) . "<br>";
            echo "Max Aktivierungen: " . $license['max_activations'] . "<br>";
            echo "Erstellt: " . date('d.m.Y H:i', strtotime($license['created_at'])) . "<br>";
            echo "</div>";
            
            echo "<p><a href='license_details.php?key=" . urlencode($test_key) . "' class='ok' target='_blank'>📊 Details-Seite öffnen</a></p>";
            
        } else {
            echo "<span class='error'>❌ Lizenz nicht gefunden!</span><br>";
            echo "<div class='code'>";
            echo "<strong>Mögliche Gründe:</strong><br>";
            echo "1. Lizenzschlüssel falsch geschrieben<br>";
            echo "2. Lizenz wurde gelöscht<br>";
            echo "3. Lizenz existiert nicht in der Datenbank<br>";
            echo "</div>";
        }
        
    } catch (Exception $e) {
        echo "<span class='error'>❌ Datenbankfehler: " . $e->getMessage() . "</span><br>";
    }
}

// 5. Aktivierungen prüfen
echo "<h2>📱 Aktivierungen-Status</h2>";
try {
    $stmt = $pdo->query("
        SELECT la.*, l.license_key
        FROM license_activations la
        LEFT JOIN licenses l ON la.license_key = l.license_key
        ORDER BY la.last_validation DESC
        LIMIT 10
    ");
    $activations = $stmt->fetchAll();
    
    if (empty($activations)) {
        echo "<span class='warning'>⚠️ Keine Aktivierungen gefunden</span><br>";
    } else {
        echo "<span class='ok'>✅ " . count($activations) . " Aktivierung(en) gefunden (letzte 10):</span><br><br>";
        
        echo "<table>";
        echo "<tr><th>Lizenz</th><th>Hardware-ID</th><th>Status</th><th>Erste Aktivierung</th><th>Letzte Validierung</th><th>Zugriffe</th></tr>";
        
        foreach ($activations as $activation) {
            $status_color = $activation['status'] === 'active' ? 'green' : 'red';
            
            echo "<tr>";
            echo "<td><span class='license-key'>" . htmlspecialchars(substr($activation['license_key'], 0, 12)) . "...</span></td>";
            echo "<td><span class='license-key'>" . htmlspecialchars(substr($activation['hardware_id'], 0, 12)) . "...</span></td>";
            echo "<td style='color:$status_color; font-weight:bold;'>" . htmlspecialchars($activation['status']) . "</td>";
            echo "<td>" . date('d.m.Y H:i', strtotime($activation['first_activation'])) . "</td>";
            echo "<td>" . date('d.m.Y H:i', strtotime($activation['last_validation'])) . "</td>";
            echo "<td>" . $activation['validation_count'] . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    }
    
} catch (Exception $e) {
    echo "<span class='error'>❌ Fehler beim Laden der Aktivierungen: " . $e->getMessage() . "</span><br>";
}

// 6. File-Check
echo "<h2>📁 Datei-Check</h2>";
$files = [
    'license_details.php' => 'Details-Seite',
    'admin_actions.php' => 'Admin-Aktionen',
    'create_license.php' => 'Lizenz erstellen',
    'index.php' => 'Dashboard'
];

foreach ($files as $file => $description) {
    if (file_exists($file)) {
        echo "✅ <strong>$file</strong> ($description) - " . round(filesize($file)/1024, 1) . " KB<br>";
    } else {
        echo "<span class='error'>❌ $file ($description) - FEHLT!</span><br>";
    }
}

// 7. Schnell-Aktionen
echo "<h2>⚡ Schnell-Aktionen</h2>";
echo "<div class='code'>";
echo "<strong>Navigation:</strong><br>";
echo "<a href='index.php'>📊 Admin-Dashboard</a> | ";
echo "<a href='../debug.php'>🔧 Server-Debug</a> | ";
echo "<a href='../api/validate.php'>📡 API-Test</a><br><br>";

echo "<strong>Test-URLs:</strong><br>";
if (!empty($licenses)) {
    $first_license = $licenses[0];
    echo "<a href='license_details.php?key=" . urlencode($first_license['license_key']) . "'>📊 Erste Lizenz testen</a><br>";
}
echo "</div>";

// 8. Automatische Test-Lizenz erstellen (falls keine vorhanden)
if (empty($licenses) && isset($_GET['create_test'])) {
    echo "<h2>🧪 Test-Lizenz erstellen</h2>";
    
    try {
        $pdo->beginTransaction();
        
        // Test-Kunde erstellen
        $stmt = $pdo->prepare("INSERT INTO customers (name, email, company) VALUES (?, ?, ?)");
        $stmt->execute(['Test Kunde Debug', 'debug@test.com', 'Debug Firma']);
        $customer_id = $pdo->lastInsertId();
        
        // Test-Lizenz erstellen
        $test_license_key = 'DEBUG-' . date('md') . '-' . rand(1000, 9999) . '-TEST';
        $stmt = $pdo->prepare("
            INSERT INTO licenses (license_key, customer_id, license_type, max_activations, expires_at, price) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$test_license_key, $customer_id, 'professional', 2, '2025-12-31 23:59:59', 299.00]);
        
        // Test-Features erstellen
        $stmt = $pdo->prepare("INSERT INTO license_features (license_key, feature_name) VALUES (?, ?)");
        $stmt->execute([$test_license_key, 'basic']);
        $stmt->execute([$test_license_key, 'backup']);
        
        $pdo->commit();
        
        echo "<span class='ok'>✅ Test-Lizenz erstellt: <span class='license-key'>$test_license_key</span></span><br>";
        echo "<p><a href='license_details.php?key=" . urlencode($test_license_key) . "'>📊 Test-Lizenz Details öffnen</a></p>";
        echo "<p><a href='debug_db.php'>🔄 Seite neu laden</a></p>";
        
    } catch (Exception $e) {
        $pdo->rollback();
        echo "<span class='error'>❌ Fehler beim Erstellen der Test-Lizenz: " . $e->getMessage() . "</span><br>";
    }
}

if (empty($licenses)) {
    echo "<p><a href='debug_db.php?create_test=1' style='background:#28a745;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;'>🧪 Test-Lizenz automatisch erstellen</a></p>";
}

echo "<hr>";
echo "<p><em>Debug-Script: " . date('d.m.Y H:i:s') . "</em></p>";
?>