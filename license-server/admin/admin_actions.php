<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once '../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$license_key = $input['license_key'] ?? '';

try {
    switch ($action) {
        case 'suspend':
            $stmt = $pdo->prepare("
                UPDATE licenses 
                SET status = 'suspended', updated_at = NOW()
                WHERE license_key = ?
            ");
            $stmt->execute([$license_key]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('license_suspended', ['license_key' => $license_key]);
                echo json_encode(['success' => true, 'message' => 'Lizenz gesperrt']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Lizenz nicht gefunden']);
            }
            break;

        case 'activate':
            $stmt = $pdo->prepare("
                UPDATE licenses 
                SET status = 'active', updated_at = NOW()
                WHERE license_key = ?
            ");
            $stmt->execute([$license_key]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('license_activated', ['license_key' => $license_key]);
                echo json_encode(['success' => true, 'message' => 'Lizenz aktiviert']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Lizenz nicht gefunden']);
            }
            break;

        case 'deactivate_hardware':
            $hardware_id = $input['hardware_id'] ?? '';
            
            if (empty($hardware_id)) {
                echo json_encode(['success' => false, 'error' => 'Hardware-ID fehlt']);
                break;
            }
            
            $stmt = $pdo->prepare("
                UPDATE license_activations 
                SET status = 'deactivated', deactivated_at = NOW()
                WHERE license_key = ? AND hardware_id = ? AND status = 'active'
            ");
            $stmt->execute([$license_key, $hardware_id]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('hardware_deactivated', [
                    'license_key' => $license_key,
                    'hardware_id' => $hardware_id
                ]);
                echo json_encode(['success' => true, 'message' => 'Hardware-Aktivierung deaktiviert']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Aktive Aktivierung nicht gefunden']);
            }
            break;

        case 'reactivate_hardware':
            $hardware_id = $input['hardware_id'] ?? '';
            
            if (empty($hardware_id)) {
                echo json_encode(['success' => false, 'error' => 'Hardware-ID fehlt']);
                break;
            }
            
            // Prüfen ob Hardware-ID existiert und deaktiviert ist
            $stmt = $pdo->prepare("
                SELECT * FROM license_activations 
                WHERE license_key = ? AND hardware_id = ? AND status = 'deactivated'
            ");
            $stmt->execute([$license_key, $hardware_id]);
            $deactivated_hardware = $stmt->fetch();
            
            if (!$deactivated_hardware) {
                echo json_encode(['success' => false, 'error' => 'Deaktivierte Hardware-ID nicht gefunden']);
                break;
            }
            
            // Prüfen ob noch Platz für Reaktivierung vorhanden ist
            $stmt = $pdo->prepare("
                SELECT l.max_activations, COUNT(la.id) as current_active
                FROM licenses l
                LEFT JOIN license_activations la ON l.license_key = la.license_key AND la.status = 'active'
                WHERE l.license_key = ?
                GROUP BY l.id
            ");
            $stmt->execute([$license_key]);
            $license_info = $stmt->fetch();
            
            if ($license_info['current_active'] >= $license_info['max_activations']) {
                echo json_encode([
                    'success' => false, 
                    'error' => 'Maximum Anzahl Aktivierungen erreicht (' . $license_info['max_activations'] . ')'
                ]);
                break;
            }
            
            // Hardware-ID reaktivieren
            $stmt = $pdo->prepare("
                UPDATE license_activations 
                SET status = 'active', 
                    last_validation = NOW(), 
                    deactivated_at = NULL
                WHERE license_key = ? AND hardware_id = ? AND status = 'deactivated'
            ");
            $stmt->execute([$license_key, $hardware_id]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('hardware_reactivated_admin', [
                    'license_key' => $license_key,
                    'hardware_id' => $hardware_id
                ]);
                echo json_encode(['success' => true, 'message' => 'Hardware-Aktivierung reaktiviert']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Reaktivierung fehlgeschlagen']);
            }
            break;

        case 'delete_hardware':
            $hardware_id = $input['hardware_id'] ?? '';
            
            if (empty($hardware_id)) {
                echo json_encode(['success' => false, 'error' => 'Hardware-ID fehlt']);
                break;
            }
            
            $stmt = $pdo->prepare("
                DELETE FROM license_activations 
                WHERE license_key = ? AND hardware_id = ?
            ");
            $stmt->execute([$license_key, $hardware_id]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('hardware_deleted', [
                    'license_key' => $license_key,
                    'hardware_id' => $hardware_id
                ]);
                echo json_encode(['success' => true, 'message' => 'Hardware-Aktivierung komplett gelöscht']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Hardware-Aktivierung nicht gefunden']);
            }
            break;

        case 'extend_license':
            $new_expiry = $input['new_expiry'] ?? '';
            
            if (empty($new_expiry)) {
                echo json_encode(['success' => false, 'error' => 'Neues Ablaufdatum fehlt']);
                break;
            }
            
            $stmt = $pdo->prepare("
                UPDATE licenses 
                SET expires_at = ?, updated_at = NOW()
                WHERE license_key = ?
            ");
            $stmt->execute([$new_expiry, $license_key]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('license_extended', [
                    'license_key' => $license_key,
                    'new_expiry' => $new_expiry
                ]);
                echo json_encode(['success' => true, 'message' => 'Lizenz verlängert bis ' . date('d.m.Y', strtotime($new_expiry))]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Lizenz nicht gefunden']);
            }
            break;

        case 'delete_license':
            // Sicherheitsabfrage - nur inaktive Lizenzen löschen
            $stmt = $pdo->prepare("
                SELECT COUNT(*) FROM license_activations 
                WHERE license_key = ? AND status = 'active'
            ");
            $stmt->execute([$license_key]);
            $active_count = $stmt->fetchColumn();
            
            if ($active_count > 0) {
                echo json_encode(['success' => false, 'error' => 'Lizenz hat aktive Aktivierungen - zuerst deaktivieren']);
                break;
            }
            
            // Lizenz und alle Daten löschen
            $pdo->beginTransaction();
            
            // Features löschen
            $stmt = $pdo->prepare("DELETE FROM license_features WHERE license_key = ?");
            $stmt->execute([$license_key]);
            
            // Aktivierungen löschen
            $stmt = $pdo->prepare("DELETE FROM license_activations WHERE license_key = ?");
            $stmt->execute([$license_key]);
            
            // Lizenz löschen
            $stmt = $pdo->prepare("DELETE FROM licenses WHERE license_key = ?");
            $stmt->execute([$license_key]);
            
            if ($stmt->rowCount() > 0) {
                $pdo->commit();
                logActivity('license_deleted', ['license_key' => $license_key]);
                echo json_encode(['success' => true, 'message' => 'Lizenz komplett gelöscht']);
            } else {
                $pdo->rollback();
                echo json_encode(['success' => false, 'error' => 'Lizenz nicht gefunden']);
            }
            break;

        case 'change_activations':
            $new_max = (int)($input['new_max'] ?? 1);
            
            if ($new_max < 1 || $new_max > 10) {
                echo json_encode(['success' => false, 'error' => 'Ungültige Anzahl (1-10 erlaubt)']);
                break;
            }
            
            $stmt = $pdo->prepare("
                UPDATE licenses 
                SET max_activations = ?, updated_at = NOW()
                WHERE license_key = ?
            ");
            $stmt->execute([$new_max, $license_key]);
            
            if ($stmt->rowCount() > 0) {
                logActivity('activations_changed', [
                    'license_key' => $license_key,
                    'new_max' => $new_max
                ]);
                echo json_encode(['success' => true, 'message' => "Max. Aktivierungen auf $new_max geändert"]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Lizenz nicht gefunden']);
            }
            break;

        case 'regenerate_key':
            // Neuen Lizenzschlüssel generieren
            do {
                $new_key = 'KFZ' . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' .
                          str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' .
                          str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' .
                          str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
                
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM licenses WHERE license_key = ?");
                $stmt->execute([$new_key]);
                $exists = $stmt->fetchColumn();
            } while ($exists > 0);
            
            $pdo->beginTransaction();
            
            // Features übertragen
            $stmt = $pdo->prepare("
                UPDATE license_features 
                SET license_key = ? 
                WHERE license_key = ?
            ");
            $stmt->execute([$new_key, $license_key]);
            
            // Aktivierungen übertragen
            $stmt = $pdo->prepare("
                UPDATE license_activations 
                SET license_key = ? 
                WHERE license_key = ?
            ");
            $stmt->execute([$new_key, $license_key]);
            
            // Lizenz-Key ändern
            $stmt = $pdo->prepare("
                UPDATE licenses 
                SET license_key = ?, updated_at = NOW()
                WHERE license_key = ?
            ");
            $stmt->execute([$new_key, $license_key]);
            
            if ($stmt->rowCount() > 0) {
                $pdo->commit();
                logActivity('license_key_regenerated', [
                    'old_key' => $license_key,
                    'new_key' => $new_key
                ]);
                echo json_encode(['success' => true, 'message' => 'Neuer Lizenzschlüssel generiert', 'new_key' => $new_key]);
            } else {
                $pdo->rollback();
                echo json_encode(['success' => false, 'error' => 'Lizenz nicht gefunden']);
            }
            break;

        case 'get_hardware_status':
            // Neue Aktion: Hardware-Status für eine Lizenz abrufen
            $stmt = $pdo->prepare("
                SELECT hardware_id, status, first_activation, last_validation, 
                       deactivated_at, validation_count, app_version, last_ip
                FROM license_activations 
                WHERE license_key = ?
                ORDER BY 
                    CASE WHEN status = 'active' THEN 1 
                         WHEN status = 'deactivated' THEN 2 
                         ELSE 3 END,
                    last_validation DESC
            ");
            $stmt->execute([$license_key]);
            $hardware_list = $stmt->fetchAll();
            
            echo json_encode([
                'success' => true, 
                'hardware' => $hardware_list,
                'count' => count($hardware_list)
            ]);
            break;

        default:
            echo json_encode(['success' => false, 'error' => 'Unbekannte Aktion: ' . $action]);
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log('Admin action error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Interner Serverfehler: ' . $e->getMessage()]);
}