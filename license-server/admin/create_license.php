<?php
require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

try {
    $pdo->beginTransaction();

    // Kunde erstellen oder finden
    $customer_name = trim($_POST['customer_name']);
    $customer_email = trim($_POST['customer_email']);
    $company = trim($_POST['company']);

    // Validierung
    if (empty($customer_name) || empty($customer_email)) {
        throw new Exception('Name und E-Mail sind erforderlich');
    }

    if (!filter_var($customer_email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Ungültige E-Mail-Adresse');
    }

    // Prüfen ob Kunde bereits existiert
    $stmt = $pdo->prepare("SELECT id FROM customers WHERE email = ?");
    $stmt->execute([$customer_email]);
    $customer = $stmt->fetch();

    if ($customer) {
        $customer_id = $customer['id'];
        
        // Kundendaten aktualisieren
        $stmt = $pdo->prepare("
            UPDATE customers 
            SET name = ?, company = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$customer_name, $company, $customer_id]);
    } else {
        // Neuen Kunden erstellen
        $stmt = $pdo->prepare("
            INSERT INTO customers (name, email, company) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$customer_name, $customer_email, $company]);
        $customer_id = $pdo->lastInsertId();
    }

    // Lizenzschlüssel generieren
    do {
        $license_key = 'KFZ' . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' .
                      str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' .
                      str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' .
                      str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
        
        // Prüfen ob Schlüssel bereits existiert
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM licenses WHERE license_key = ?");
        $stmt->execute([$license_key]);
        $exists = $stmt->fetchColumn();
    } while ($exists > 0);

    // Lizenz erstellen
    $license_type = $_POST['license_type'];
    $max_activations = (int)$_POST['max_activations'];
    $expires_at = !empty($_POST['expires_at']) ? $_POST['expires_at'] . ' 23:59:59' : null;
    $price = (float)($_POST['price'] ?? 0);

    $stmt = $pdo->prepare("
        INSERT INTO licenses (license_key, customer_id, license_type, max_activations, expires_at, price) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$license_key, $customer_id, $license_type, $max_activations, $expires_at, $price]);

    // Features hinzufügen
    if (isset($_POST['features']) && is_array($_POST['features'])) {
        $stmt = $pdo->prepare("
            INSERT INTO license_features (license_key, feature_name) 
            VALUES (?, ?)
        ");
        
        foreach ($_POST['features'] as $feature) {
            $stmt->execute([$license_key, $feature]);
        }
    } else {
        // Standard-Feature hinzufügen
        $stmt = $pdo->prepare("INSERT INTO license_features (license_key, feature_name) VALUES (?, 'basic')");
        $stmt->execute([$license_key]);
    }

    $pdo->commit();
    
    logActivity('license_created', [
        'license_key' => $license_key,
        'customer_name' => $customer_name,
        'customer_email' => $customer_email,
        'license_type' => $license_type,
        'max_activations' => $max_activations,
        'price' => $price
    ]);

    // Weiterleitung mit Erfolgsmeldung
    header('Location: index.php?success=created&key=' . urlencode($license_key));
    exit;

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    $error_message = $e->getMessage();
    error_log('License creation error: ' . $error_message);
    header('Location: index.php?error=' . urlencode($error_message));
    exit;
}