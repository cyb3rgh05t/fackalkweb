<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Fehler unterdrücken (wichtig für sauberes JSON)
error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once '../config/database.php';

// Request-Daten lesen
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$license_key = $input['license_key'] ?? '';
$hardware_id = $input['hardware_id'] ?? '';
$app_version = $input['app_version'] ?? '';
$timestamp = $input['timestamp'] ?? time();

if (empty($license_key) || empty($hardware_id)) {
    http_response_code(400);
    echo json_encode(['error' => 'License key and hardware ID required']);
    exit;
}

// Rate Limiting (einfach)
$client_ip = $_SERVER['REMOTE_ADDR'];
$stmt = $pdo->prepare("
    SELECT COUNT(*) as requests 
    FROM activity_log 
    WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
");
$stmt->execute([$client_ip]);
$requests = $stmt->fetchColumn();

if ($requests > 100) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded']);
    exit;
}

try {
    // 1. Lizenz in Datenbank suchen
    $stmt = $pdo->prepare("
        SELECT l.*, c.name as customer_name, c.email as customer_email
        FROM licenses l 
        JOIN customers c ON l.customer_id = c.id 
        WHERE l.license_key = ? AND l.status = 'active'
    ");
    $stmt->execute([$license_key]);
    $license = $stmt->fetch();

    if (!$license) {
        logActivity('validation_failed', [
            'license_key' => $license_key,
            'hardware_id' => $hardware_id,
            'reason' => 'license_not_found_or_deactivated'
        ]);
        
        http_response_code(400);
        echo json_encode([
            'valid' => false,
            'error' => 'Lizenzschlüssel ungültig oder deaktiviert'
        ]);
        exit;
    }

    // 2. Ablaufdatum prüfen
    if ($license['expires_at'] && strtotime($license['expires_at']) < time()) {
        logActivity('validation_failed', [
            'license_key' => $license_key,
            'hardware_id' => $hardware_id,
            'reason' => 'license_expired'
        ]);
        
        http_response_code(400);
        echo json_encode([
            'valid' => false,
            'error' => 'Lizenz abgelaufen am ' . date('d.m.Y', strtotime($license['expires_at']))
        ]);
        exit;
    }

    // 3. Aktuelle aktive Aktivierungen zählen
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as active_count 
        FROM license_activations 
        WHERE license_key = ? AND status = 'active'
    ");
    $stmt->execute([$license_key]);
    $activation_count = (int)$stmt->fetchColumn();

    // 4. Hardware-Aktivierungen prüfen (KORRIGIERT: KEINE AUTOMATISCHE REAKTIVIERUNG)
    $stmt = $pdo->prepare("
        SELECT * FROM license_activations 
        WHERE license_key = ? AND hardware_id = ?
        ORDER BY 
            CASE WHEN status = 'active' THEN 1 
                 WHEN status = 'deactivated' THEN 2 
                 ELSE 3 END
        LIMIT 1
    ");
    $stmt->execute([$license_key, $hardware_id]);
    $existing_activation = $stmt->fetch();

    if ($existing_activation) {
        if ($existing_activation['status'] === 'active') {
            // Hardware bereits aktiv - nur Timestamp aktualisieren
            $stmt = $pdo->prepare("
                UPDATE license_activations 
                SET last_validation = NOW(), validation_count = validation_count + 1,
                    app_version = ?, last_ip = ?
                WHERE id = ?
            ");
            $stmt->execute([$app_version, $client_ip, $existing_activation['id']]);
            
            logActivity('validation_success', [
                'license_key' => $license_key,
                'hardware_id' => $hardware_id,
                'validation_count' => (int)$existing_activation['validation_count'] + 1,
                'status' => 'existing_active'
            ]);
            
            $current_activations = $activation_count;
            
        } elseif ($existing_activation['status'] === 'deactivated') {
            // ===== KORREKTUR: HARDWARE DEAKTIVIERT - KEINE AUTOMATISCHE REAKTIVIERUNG =====
            
            logActivity('hardware_deactivated_access_denied', [
                'license_key' => $license_key,
                'hardware_id' => $hardware_id,
                'deactivated_at' => $existing_activation['deactivated_at'],
                'reason' => 'hardware_manually_deactivated'
            ]);
            
            http_response_code(403); // 403 Forbidden statt 400
            echo json_encode([
                'valid' => false,
                'error' => 'Hardware-ID wurde deaktiviert und muss manuell reaktiviert werden',
                'hardware_deactivated' => true,
                'deactivated_at' => $existing_activation['deactivated_at'],
                'current_activations' => $activation_count,
                'max_activations' => (int)$license['max_activations'],
                'manual_reactivation_required' => true
            ]);
            exit;
        }
        
    } else {
        // Komplett neue Hardware - prüfen ob noch Aktivierungen verfügbar
        if ($activation_count >= $license['max_activations']) {
            logActivity('validation_failed', [
                'license_key' => $license_key,
                'hardware_id' => $hardware_id,
                'reason' => 'max_activations_reached',
                'current_count' => $activation_count,
                'max_allowed' => (int)$license['max_activations']
            ]);
            
            http_response_code(400);
            echo json_encode([
                'valid' => false,
                'error' => 'Maximum Anzahl Aktivierungen erreicht (' . $license['max_activations'] . ')',
                'current_activations' => $activation_count,
                'max_activations' => (int)$license['max_activations']
            ]);
            exit;
        }

        // Neue Aktivierung erstellen
        $stmt = $pdo->prepare("
            INSERT INTO license_activations 
            (license_key, hardware_id, first_activation, last_validation, status, app_version, last_ip) 
            VALUES (?, ?, NOW(), NOW(), 'active', ?, ?)
        ");
        $stmt->execute([$license_key, $hardware_id, $app_version, $client_ip]);
        
        logActivity('new_activation', [
            'license_key' => $license_key,
            'hardware_id' => $hardware_id,
            'app_version' => $app_version
        ]);
        
        // Neue Aktivierung hinzugefügt
        $current_activations = $activation_count + 1;
    }

    // 5. Lizenz-Features laden
    $stmt = $pdo->prepare("
        SELECT feature_name FROM license_features 
        WHERE license_key = ?
    ");
    $stmt->execute([$license_key]);
    $features = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($features)) {
        $features = ['basic']; // Standard-Features
    }

    // 6. Erfolgreiche Validierung
    $response = [
        'valid' => true,
        'expires_at' => $license['expires_at'] ? strtotime($license['expires_at']) * 1000 : null,
        'user_info' => [
            'customer_name' => $license['customer_name'],
            'customer_email' => $license['customer_email'],
            'license_type' => $license['license_type']
        ],
        'features' => $features,
        'max_activations' => (int)$license['max_activations'],
        'current_activations' => $current_activations,
        'validation_timestamp' => time(),
        'hardware_status' => 'active'
    ];

    echo json_encode($response);

} catch (PDOException $e) {
    error_log('License validation error: ' . $e->getMessage());
    logActivity('validation_error', ['error' => $e->getMessage()]);
    
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
} catch (Exception $e) {
    error_log('General validation error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}